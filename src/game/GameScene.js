/**
 * GameScene.js
 * Main gameplay scene orchestrating local rendering and multiplayer synchronization.
 */

import { createInitialState, refillShotgun, ITEM_KEYS } from './gameLogic.js';
import { ASSETS, SOUNDS, AVATAR_KEYS } from './LayoutConfig.js';
import { getLayout, getScale } from './ResponsiveLayout.js';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { ITEMS } from '@/utils/constants';
import { createLogger } from '@/utils/logger';

// Managers
import { EffectsManager } from './EffectsManager.js';
import { AIController } from './AIController.js';
import { HUDManager } from './managers/HUDManager.js';
import { PlayerManager } from './managers/PlayerManager.js';
import { GunManager } from './managers/GunManager.js';
import { AmmoRenderer } from './managers/AmmoRenderer.js';
import { UIManager } from './managers/UIManager.js';
import { ActionHandler } from './managers/ActionHandler.js';
import { RoundManager } from './managers/RoundManager.js';
import { ItemRenderer } from './managers/ItemRenderer.js';
import { ImageService } from './services/ImageService.js';

const STORE_TO_LOGIC_ITEM_KEY = Object.freeze({
  [ITEMS.KNIFE]: ITEM_KEYS.KNIFE,
  [ITEMS.MAGNIFYING_GLASS]: ITEM_KEYS.MAGNIFYING_GLASS,
  [ITEMS.HANDCUFFS]: ITEM_KEYS.HANDCUFFS,
  [ITEMS.BEER]: ITEM_KEYS.BEER,
  [ITEMS.CIGARETTE]: ITEM_KEYS.CIGARETTE
});

const LOGIC_TO_STORE_ITEM_KEY = Object.freeze(
  Object.fromEntries(Object.entries(STORE_TO_LOGIC_ITEM_KEY).map(([storeKey, logicKey]) => [logicKey, storeKey]))
);

const logger = createLogger('GameScene');
const MULTIPLAYER_ACTION_ACK_TIMEOUT_MS = 8000;
const MULTIPLAYER_ACTION_SYNC_LEAD_MS = 180;
const MULTIPLAYER_ACTION_FALLBACK_DURATION_MS = 520;
const REVEAL_SEEN_STORAGE_KEY = 'bang_or_blank_seen_round_reveal';
const LEGACY_REVEAL_SEEN_STORAGE_KEY = 'buckshot_seen_round_reveal';
const DANGER_SCREEN_DEPTH = 85;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');

    this.isMultiplayer = false;
    this.gameStore = null;
    this.roomStore = null;
    this.currentUserId = null;

    this.multiplayerReadyNotified = false;
    this.multiplayerFlowStarted = false;
    this.multiplayerUpdateHandler = null;

    this.pendingMultiplayerAction = null;
    this.musicStarted = false;
    this.multiplayerActionQueue = [];
    this.isPlayingMultiplayerAction = false;
    this.currentMatchId = null;
    this.lastStateVersion = -1;
    this.bootstrapStateVersion = -1;
    this.bgImage = null;
    this.bgShade = null;
    this.resizeHandler = null;
    this.dangerScreenOverlay = null;
    this.dangerScreenPulseTween = null;
    this.dangerScreenActive = false;
    this.dangerScreenTextureKey = 'dangerScreenVignette';
    this.localPlayerIndex = 0;
    this.lastAfkUiSyncAtMs = 0;
    this.pendingMultiplayerItemSelection = null;
  }

  /**
   * Initialize scene from registry data.
   * @param {object} data - Scene init payload.
   */
  init(data) {
    this.playerName = data.playerName || 'YOU';
    this.isMultiplayer = this.registry.get('isMultiplayer') || false;
    this.currentUserId = this.registry.get('currentUserId') || null;
    this.gameStore = this.isMultiplayer ? this.registry.get('gameStore') : null;
    this.roomStore = this.isMultiplayer ? useRoomStore() : null;

    this.multiplayerReadyNotified = false;
    this.multiplayerFlowStarted = false;
    this.pendingMultiplayerAction = null;
    this.musicStarted = false;
    this.multiplayerActionQueue = [];
    this.isPlayingMultiplayerAction = false;
    this.currentMatchId = this.gameStore?.currentGame?.matchId || null;
    this.lastStateVersion = -1;
    this.bootstrapStateVersion = -1;
    this.localPlayerIndex = 0;
    this.lastAfkUiSyncAtMs = 0;
    this.pendingMultiplayerItemSelection = null;
    this.dangerScreenOverlay = null;
    this.dangerScreenPulseTween = null;
    this.dangerScreenActive = false;
  }

  /**
   * Get responsive layout constants.
   * @returns {object}
   */
  getLayout() {
    return getLayout(this);
  }

  /**
   * Get responsive scale constants.
   * @returns {object}
   */
  getScale() {
    return getScale(this);
  }

  /**
   * Resolve local authenticated user id.
   * @returns {string | null}
   */
  getMyUserId() {
    let authUserId = null;
    try {
      authUserId = useAuthStore()?.userId || null;
    } catch (_err) {
      // Ignore store bootstrap timing race.
    }

    const gamePlayers = this.gameStore?.currentGame?.players || [];
    const containsUser = (userId) =>
      !!userId && (!gamePlayers.length || gamePlayers.some(player => player?.userId === userId));

    if (containsUser(authUserId)) {
      if (this.currentUserId && this.currentUserId !== authUserId) {
        logger.debug('local_user_id_rebound', {
          from: this.currentUserId,
          to: authUserId
        });
      }
      this.currentUserId = authUserId;
      return this.currentUserId;
    }

    if (containsUser(this.currentUserId)) {
      return this.currentUserId;
    }

    const fallback = this.gameStore?.myPlayer?.userId || null;
    if (containsUser(fallback)) {
      this.currentUserId = fallback;
      return this.currentUserId;
    }

    if (authUserId) {
      this.currentUserId = authUserId;
      return this.currentUserId;
    }

    return this.currentUserId || null;
  }

  /**
   * Normalize store item key to local gameLogic key.
   * @param {string} itemKey - Input item key.
   * @returns {string}
   */
  normalizeItemKey(itemKey) {
    return STORE_TO_LOGIC_ITEM_KEY[itemKey] || itemKey;
  }

  /**
   * Convert local gameLogic item key to store key.
   * @param {string} itemKey - Local item key.
   * @returns {string}
   */
  toStoreItemKey(itemKey) {
    return LOGIC_TO_STORE_ITEM_KEY[itemKey] || itemKey;
  }

  /**
   * Resolve latest room presence map by user id.
   * @returns {Record<string, {isConnected: boolean, status: string, stale: boolean, lastPingMs: number}>}
   */
  getPresenceMapByUserId() {
    if (!this.isMultiplayer) return {};
    const store = this.roomStore || useRoomStore();
    return store?.playerPresenceById || {};
  }

  /**
   * Build compact presence signature for multiplayer hash checks.
   * @returns {Array<object>}
   */
  getPresenceSignature() {
    const presenceMap = this.getPresenceMapByUserId();
    return Object.entries(presenceMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([userId, value]) => ({
        userId,
        isConnected: !!value?.isConnected,
        status: value?.status || 'unknown',
        stale: !!value?.stale
      }));
  }

  /**
   * Resolve local player index in current mapped state.
   * @returns {number}
   */
  getLocalPlayerIndex() {
    if (!this.isMultiplayer) return 0;
    if (!this.state?.players?.length) return this.localPlayerIndex || 0;

    const myUserId = this.getMyUserId();
    if (!myUserId) return this.localPlayerIndex || 0;

    const index = this.state.players.findIndex(player => player.userId === myUserId);
    if (index >= 0) {
      this.localPlayerIndex = index;
      return index;
    }
    return this.localPlayerIndex || 0;
  }

  /**
   * Resolve active turn actor user id from authoritative state.
   * @returns {string | null}
   */
  getTurnActorUserId() {
    if (!this.isMultiplayer) return null;
    const game = this.gameStore?.currentGame;
    return game?.turnContext?.playerId || game?.players?.[game?.currentTurn]?.userId || null;
  }

  /**
   * Ensure reusable full-screen danger vignette texture exists.
   * @returns {string | null}
   */
  ensureDangerScreenTexture() {
    const key = this.dangerScreenTextureKey;
    if (this.textures?.exists?.(key)) return key;

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    const center = size / 2;
    const radial = ctx.createRadialGradient(center, center, size * 0.1, center, center, size * 0.66);
    radial.addColorStop(0, 'rgba(28, 0, 0, 0)');
    radial.addColorStop(0.44, 'rgba(70, 0, 0, 0.20)');
    radial.addColorStop(0.72, 'rgba(120, 0, 0, 0.54)');
    radial.addColorStop(1, 'rgba(76, 0, 0, 0.94)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);

    this.textures.addCanvas(key, canvas);
    return key;
  }

  /**
   * Create the full-screen danger overlay.
   */
  setupDangerScreenOverlay() {
    const texture = this.ensureDangerScreenTexture();
    if (!texture) return;

    const layout = this.getLayout();
    this.dangerScreenOverlay = this.imageService.createImage(
      layout.CENTER_X,
      layout.HEIGHT / 2,
      texture,
      {
        alpha: 0,
        visible: false,
        depth: DANGER_SCREEN_DEPTH
      }
    );
    this.updateDangerScreenOverlayLayout(layout);
  }

  /**
   * Keep full-screen danger overlay fitted to viewport.
   * @param {object} layout - Responsive layout constants.
   */
  updateDangerScreenOverlayLayout(layout = this.getLayout()) {
    if (!this.dangerScreenOverlay) return;

    this.dangerScreenOverlay.setPosition(layout.CENTER_X, layout.HEIGHT / 2);
    this.dangerScreenOverlay.setDisplaySize(layout.WIDTH * 1.1, layout.HEIGHT * 1.1);
  }

  /**
   * Stop full-screen danger pulse tween.
   */
  clearDangerScreenPulseTween() {
    if (this.dangerScreenPulseTween) {
      this.dangerScreenPulseTween.stop();
      this.dangerScreenPulseTween.remove();
      this.dangerScreenPulseTween = null;
    }
  }

  /**
   * Show full-screen danger overlay with fast entry + subtle pulse.
   */
  showDangerScreenOverlay() {
    if (!this.dangerScreenOverlay) return;
    if (this.dangerScreenActive) return;

    this.dangerScreenActive = true;
    this.clearDangerScreenPulseTween();
    this.tweens.killTweensOf(this.dangerScreenOverlay);

    this.updateDangerScreenOverlayLayout(this.getLayout());
    this.dangerScreenOverlay.setVisible(true);
    this.dangerScreenOverlay.setScale(1);
    this.dangerScreenOverlay.setAlpha(0);

    this.tweens.add({
      targets: this.dangerScreenOverlay,
      alpha: 0.84,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!this.dangerScreenActive || !this.dangerScreenOverlay) return;
        this.dangerScreenPulseTween = this.tweens.add({
          targets: this.dangerScreenOverlay,
          alpha: { from: 0.74, to: 0.89 },
          scale: { from: 1, to: 1.02 },
          duration: 620,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      }
    });
  }

  /**
   * Hide full-screen danger overlay quickly.
   */
  hideDangerScreenOverlay() {
    if (!this.dangerScreenOverlay) return;
    if (!this.dangerScreenActive && !this.dangerScreenOverlay.visible) return;
    if (!this.dangerScreenActive && this.tweens.isTweening(this.dangerScreenOverlay)) return;

    this.dangerScreenActive = false;
    this.clearDangerScreenPulseTween();
    this.tweens.killTweensOf(this.dangerScreenOverlay);

    this.tweens.add({
      targets: this.dangerScreenOverlay,
      alpha: 0,
      duration: 130,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!this.dangerScreenOverlay || this.dangerScreenActive) return;
        this.dangerScreenOverlay.setVisible(false);
        this.dangerScreenOverlay.setScale(1);
      }
    });
  }

  /**
   * Update danger-screen visibility based on current selection.
   * @param {number | null} dangerTargetIndex - Local target index when danger should be visible.
   */
  updateDangerScreenEffect(dangerTargetIndex) {
    this.updateDangerScreenOverlayLayout(this.getLayout());
    if (Number.isInteger(dangerTargetIndex)) {
      this.showDangerScreenOverlay();
      return;
    }
    this.hideDangerScreenOverlay();
  }

  // ==========================================================================
  // PRELOAD
  // ==========================================================================

  preload() {
    this.load.setPath('/assets/');

    this.load.image('bg', ASSETS.BG);
    this.load.image('gun', ASSETS.GUN);
    this.load.image('crossedRevolvers', ASSETS.CROSSED_REVOLVERS);
    this.load.image('revolverImpact', ASSETS.REVOLVER_IMPACT);

    this.load.image(AVATAR_KEYS.PLAYER, ASSETS.AVATAR_PLAYER);
    this.load.image(AVATAR_KEYS.PLAYER_ACTIVE, ASSETS.AVATAR_PLAYER_ACTIVE);
    this.load.image(AVATAR_KEYS.PLAYER_DEAD, ASSETS.AVATAR_PLAYER_DEAD);
    this.load.image(AVATAR_KEYS.PLAYER_SELECTED, ASSETS.AVATAR_PLAYER_SELECTED);

    this.load.image(AVATAR_KEYS.BOT, ASSETS.AVATAR_BOT);
    this.load.image(AVATAR_KEYS.BOT_ACTIVE, ASSETS.AVATAR_BOT_ACTIVE);
    this.load.image(AVATAR_KEYS.BOT_DEAD, ASSETS.AVATAR_BOT_DEAD);
    this.load.image(AVATAR_KEYS.BOT_SELECTED, ASSETS.AVATAR_BOT_SELECTED);

    this.load.image('btnShootPlayerIdle', ASSETS.BTN_SHOOT_PLAYER_IDLE);
    this.load.image('btnShootPlayerPressed', ASSETS.BTN_SHOOT_PLAYER_PRESSED);
    this.load.image('btnShootPlayerDisabled', ASSETS.BTN_SHOOT_PLAYER_DISABLED);

    this.load.image('btnShootSelfIdle', ASSETS.BTN_SHOOT_SELF_IDLE);
    this.load.image('btnShootSelfPressed', ASSETS.BTN_SHOOT_SELF_PRESSED);
    this.load.image('btnShootSelfDisabled', ASSETS.BTN_SHOOT_SELF_DISABLED);

    this.load.image('ammoFilled', ASSETS.AMMO_FILLED);
    this.load.image('ammoEmpty', ASSETS.AMMO_EMPTY);
    this.load.image('ammoUnknown', ASSETS.AMMO_UNKNOWN);
    this.load.image('heartFull', ASSETS.HEART_FULL);
    this.load.image('heartEmpty', ASSETS.HEART_EMPTY);
    this.load.image('itemKnife', ASSETS.ITEM_KNIFE);
    this.load.image('itemMagnify', ASSETS.ITEM_MAGNIFY);
    this.load.image('itemHandcuffs', ASSETS.ITEM_HANDCUFFS);
    this.load.image('itemBeer', ASSETS.ITEM_BEER);
    this.load.image('itemCigarette', ASSETS.ITEM_CIGARETTE);

    this.load.audio('sndSpin', SOUNDS.REVOLVER_SPIN);
    this.load.audio('sndReload', SOUNDS.RELOAD);
    this.load.audio('sndGunshot', SOUNDS.GUNSHOT);
    this.load.audio('sndDryFire', SOUNDS.DRY_FIRE);
    this.load.audio('sndMusic', SOUNDS.BG_MUSIC);

    this.load.on('loaderror', (file) => {
      logger.error('asset_load_error', { key: file.key, url: file.url });
    });
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================

  create() {
    this.createGame(this.getLayout());
  }

  /**
   * Create game state, managers, and visual hierarchy.
   * @param {object} layout - Responsive layout constants.
   */
  createGame(layout) {
    if (this.isMultiplayer && this.gameStore) {
      logger.info('game_start_multiplayer');
      this.rng = { random: () => Math.random() };

      this.state = this.convertFirebaseToLocalState();
      const game = this.gameStore.currentGame;
      this.currentMatchId = game?.matchId || null;

      if (game?.shotgun) {
        this.roundStartLive = game.shotgun.liveRounds;
        this.roundStartBlank = game.shotgun.blankRounds;
        this.roundStartTotal = game.shotgun.totalRounds || game.shotgun.chamber?.length || 0;
      }
      this.bootstrapStateVersion = Number.isFinite(Number(game?.stateVersion))
        ? Number(game.stateVersion)
        : -1;

      if (!this.state) {
        logger.warn('multiplayer_state_placeholder_used');
        this.state = this.createPlaceholderState();
      }
    } else {
      logger.info('game_start_singleplayer');
      this.rng = { random: () => Math.random() };
      this.state = createInitialState();
      refillShotgun(this.state, this.rng);

      this.roundStartLive = this.state.shotgun.live;
      this.roundStartBlank = this.state.shotgun.blank;
      this.roundStartTotal = this.state.shotgun.chamber.length;
    }

    this.restartBtn = null;
    this.isProcessing = false;
    this.ammoRevealPhase = true;
    this.firedShots = [];
    this.nextAmmoRevealed = null;
    this.betweenRounds = false;
    this.targetedIndex = null;
    this.selectedTargetId = null;
    this.lastRevealedRoundNumber = null;
    this.processedActionIds = new Set();
    this.pendingMultiplayerAction = null;

    logger.debug('managers_init_start');
    this.imageService = new ImageService(this);
    this.effects = new EffectsManager(this);
    this.ai = this.isMultiplayer ? null : new AIController(this);
    this.hud = new HUDManager(this);
    this.players = new PlayerManager(this);
    this.gun = new GunManager(this);
    this.ammo = new AmmoRenderer(this);
    this.ui = new UIManager(this);
    this.action = new ActionHandler(this);
    this.round = new RoundManager(this);
    this.items = new ItemRenderer(this);
    logger.debug('managers_init_complete');

    this.bgImage = this.imageService.createImage(layout.CENTER_X, layout.HEIGHT / 2, 'bg');
    this.bgShade = this.add.rectangle(layout.CENTER_X, layout.HEIGHT / 2, layout.WIDTH, layout.HEIGHT, 0x000000, 0.25);
    this.applyBackgroundCover(layout.WIDTH, layout.HEIGHT);
    this.registerResizeHandler();
    this.setupDangerScreenOverlay();

    this.hud.setup();

    this.players.setup(this.playerName);

    this.gun.setup();
    this.ammo.setup();
    this.ui.setup();

    if (this.isMultiplayer && !this.multiplayerReadyNotified) {
      const onMultiplayerSceneReady = this.registry.get('onMultiplayerSceneReady');
      if (typeof onMultiplayerSceneReady === 'function') {
        try {
          onMultiplayerSceneReady();
          this.multiplayerReadyNotified = true;
        } catch (err) {
          logger.warn('signal_multiplayer_ready_failed', { error: err?.message || String(err) });
        }
      }
    }

    if (this.isMultiplayer) {
      const existingActions = (this.gameStore?.gameActions || [])
        .filter(action => !this.currentMatchId || !action?.matchId || action.matchId === this.currentMatchId);
      this.processedActionIds = new Set(existingActions.map(action => action.id));
      this.subscribeToGameState();
      this.render();
      this.maybeStartMultiplayerFlow();
    } else {
      this.startMusicIfNeeded();
      this.render();
      this.round.startAmmoReveal();
    }
  }

  /**
   * Scale background image in "cover" mode to remove letterboxing on any viewport.
   * @param {number} width - Canvas width.
   * @param {number} height - Canvas height.
   */
  applyBackgroundCover(width, height) {
    if (!this.bgImage) return;

    const texture = this.textures.get('bg');
    const source = texture?.getSourceImage?.();
    const sourceWidth = source?.width || this.bgImage.width || width;
    const sourceHeight = source?.height || this.bgImage.height || height;
    const coverScale = Math.max(width / sourceWidth, height / sourceHeight);

    this.bgImage.setPosition(width / 2, height / 2);
    this.bgImage.setDisplaySize(sourceWidth * coverScale, sourceHeight * coverScale);

    if (this.bgShade) {
      this.bgShade.setPosition(width / 2, height / 2);
      this.bgShade.setSize(width, height);
    }
  }

  /**
   * Keep the background cover sizing in sync with runtime Phaser resize events.
   */
  registerResizeHandler() {
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler, this);
    }

    this.resizeHandler = (gameSize) => {
      const width = gameSize?.width || this.scale.width;
      const height = gameSize?.height || this.scale.height;
      this.applyBackgroundCover(width, height);
      this.updateDangerScreenOverlayLayout(getLayout(this));
    };

    this.scale.on('resize', this.resizeHandler, this);
    this.events.once('shutdown', () => {
      if (this.resizeHandler) {
        this.scale.off('resize', this.resizeHandler, this);
        this.resizeHandler = null;
      }
      this.clearDangerScreenPulseTween();
      this.dangerScreenOverlay = null;
      this.dangerScreenActive = false;
    });
  }

  /**
   * Start background music once.
   */
  startMusicIfNeeded() {
    if (this.musicStarted) return;
    this.sound.play('sndMusic', { loop: true, volume: 0.08 });
    this.musicStarted = true;
  }

  /**
   * Start multiplayer visual flow only after start sync gate opens.
   */
  maybeStartMultiplayerFlow() {
    if (!this.isMultiplayer || !this.gameStore) return;
    if (this.multiplayerFlowStarted) return;
    if (!this.gameStore.startGateOpen) return;

    this.multiplayerFlowStarted = true;
    this.startMusicIfNeeded();

    logger.info('multiplayer_flow_started', {
      roundNumber: this.state?.roundNumber,
      turnIndex: this.state?.currentTurnIndex
    });

    const game = this.gameStore.currentGame;
    const hasAmmoData = (this.roundStartTotal || 0) > 0;
    const shouldRevealRound = hasAmmoData && this.shouldPlayInitialRoundReveal(game);

    if (shouldRevealRound) {
      if (this.gameStore?.setClientRevealPhaseActive) {
        this.gameStore.setClientRevealPhaseActive(true);
      }
      this.lastRevealedRoundNumber = this.state.roundNumber;
      this.round.startAmmoReveal();
      return;
    }

    this.lastRevealedRoundNumber = this.state?.roundNumber ?? null;
    this.ammoRevealPhase = false;
    if (hasAmmoData) {
      this.syncFiredShotsFromActionHistory(game);
    }

    if (this.gameStore?.setClientRevealPhaseActive) {
      this.gameStore.setClientRevealPhaseActive(false);
    }

    this.render();
  }

  /**
   * Convert Firebase game document to local scene state.
   * @returns {object | null}
   */
  convertFirebaseToLocalState() {
    if (!this.gameStore?.currentGame?.players) return null;

    const game = this.gameStore.currentGame;
    const myUserId = this.getMyUserId();
    if (!myUserId) return null;

    const playerIdsOrder = Array.isArray(game.playerIds) ? game.playerIds : [];
    const orderedPlayers = [...game.players]
      .sort((a, b) => {
        const aPlayerIdIdx = playerIdsOrder.indexOf(a.userId);
        const bPlayerIdIdx = playerIdsOrder.indexOf(b.userId);
        const aHasPlayerId = aPlayerIdIdx >= 0;
        const bHasPlayerId = bPlayerIdIdx >= 0;
        if (aHasPlayerId || bHasPlayerId) {
          const ai = aHasPlayerId ? aPlayerIdIdx : Number.MAX_SAFE_INTEGER;
          const bi = bHasPlayerId ? bPlayerIdIdx : Number.MAX_SAFE_INTEGER;
          if (ai !== bi) return ai - bi;
        }

        const aSlot = Number.isFinite(Number(a.slotIndex)) ? Number(a.slotIndex) : Number.MAX_SAFE_INTEGER;
        const bSlot = Number.isFinite(Number(b.slotIndex)) ? Number(b.slotIndex) : Number.MAX_SAFE_INTEGER;
        if (aSlot !== bSlot) return aSlot - bSlot;
        const aJoined = Date.parse(a.joinedAt || '') || 0;
        const bJoined = Date.parse(b.joinedAt || '') || 0;
        return aJoined - bJoined;
      })
      .slice(0, 8);

    const myIndex = orderedPlayers.findIndex(p => p.userId === myUserId);
    if (myIndex === -1) {
      logger.warn('state_map_player_index_missing');
      return null;
    }

    const presenceMap = this.getPresenceMapByUserId();

    this.localPlayerIndex = myIndex;
    const currentTurnUserId = game.turnContext?.playerId || game.players?.[game.currentTurn]?.userId || null;
    const mappedTurnIndex = orderedPlayers.findIndex(player => player.userId === currentTurnUserId);
    const localTurnIndex = mappedTurnIndex >= 0 ? mappedTurnIndex : 0;

    return {
      currentTurnIndex: localTurnIndex,
      shotgun: {
        chamber: game.shotgun?.chamber || [],
        damage: game.shotgun?.isSawedOff ? 2 : 1,
        live: game.shotgun?.liveRounds || 0,
        blank: game.shotgun?.blankRounds || 0,
        nextRoundRevealed: false
      },
      players: orderedPlayers.map((player, index) => ({
        id: player.userId || player.id || `PLAYER_${index}`,
        userId: player.userId,
        displayName: player.displayName || (player.userId === myUserId ? this.playerName : `Player ${index + 1}`),
        health: player.health,
        maxHealth: player.maxHealth || 4,
        items: (player.items || []).map(item => this.normalizeItemKey(item)),
        turnsWaiting: Math.max(0, Number(player.pendingSkipTurns || 0)),
        alive: player.isAlive !== false,
        isConnected: presenceMap[player.userId]?.isConnected ?? (player.isConnected !== false)
      })),
      gameOver: game.status === 'ended',
      roundNumber: game.currentRound || 1,
      logs: []
    };
  }

  /**
   * Build a crash-safe placeholder state until multiplayer snapshot arrives.
   * @returns {object}
   */
  createPlaceholderState() {
    return {
      currentTurnIndex: 0,
      shotgun: { chamber: [], damage: 1, live: 0, blank: 0, nextRoundRevealed: false },
      players: [
        { id: this.currentUserId || 'YOU', userId: this.currentUserId, health: 4, items: [], turnsWaiting: 0, alive: true, isConnected: true },
        { id: 'OPPONENT', health: 4, items: [], turnsWaiting: 0, alive: true, isConnected: true }
      ],
      gameOver: false,
      roundNumber: 1,
      logs: []
    };
  }

  /**
   * Subscribe scene-local update loop to multiplayer store state.
   */
  subscribeToGameState() {
    if (!this.gameStore) return;

    if (this.multiplayerUpdateHandler) {
      this.events.off('update', this.multiplayerUpdateHandler);
      this.multiplayerUpdateHandler = null;
    }

    let lastTurnNumber = -1;
    let lastStateHash = '';

    this.multiplayerUpdateHandler = () => {
      if (!this.gameStore?.currentGame) return;

      const game = this.gameStore.currentGame;
      const stateHash = JSON.stringify({
        status: game.status,
        startSyncPhase: game.startSync?.phase || null,
        currentRound: game.currentRound,
        currentTurn: game.currentTurn,
        turnNumber: game.turnNumber,
        turnStartedAt: game.turnStartedAt?.seconds || game.turnStartedAt || null,
        revealedRound: game.turnContext?.revealedRound || null,
        targetPlayerId: game.turnContext?.targetPlayerId || null,
        shotgun: {
          chamberLength: game.shotgun?.chamber?.length || 0,
          totalRounds: game.shotgun?.totalRounds || 0,
          liveRounds: game.shotgun?.liveRounds || 0,
          blankRounds: game.shotgun?.blankRounds || 0,
          isSawedOff: !!game.shotgun?.isSawedOff
        },
        players: (game.players || []).map(p => ({
          userId: p.userId,
          slotIndex: p.slotIndex,
          health: p.health,
          isAlive: p.isAlive,
          items: p.items || []
        })),
        presence: this.getPresenceSignature()
      });

      if (stateHash === lastStateHash) {
        this.processNewMultiplayerActions();
        this.releaseStalePendingAction();
        this.maybeStartMultiplayerFlow();
        const canHydrateShots =
          this.multiplayerFlowStarted &&
          !this.ammoRevealPhase &&
          !this.betweenRounds &&
          !this.isPlayingMultiplayerAction &&
          this.multiplayerActionQueue.length === 0;
        if (canHydrateShots && this.syncFiredShotsFromActionHistory(game)) {
          this.render();
        }
        return;
      }

      lastStateHash = stateHash;

      const nextState = this.convertFirebaseToLocalState();
      if (!nextState) return;

      this.state = nextState;
      this.currentMatchId = game.matchId || this.currentMatchId;
      this.roundStartTotal = game.shotgun?.totalRounds || this.state.shotgun.chamber.length;
      this.roundStartLive = this.state.shotgun.live;
      this.roundStartBlank = this.state.shotgun.blank;

      const stateVersion = Number.isFinite(Number(game.stateVersion))
        ? Number(game.stateVersion)
        : -1;
      if (stateVersion >= 0 && this.lastStateVersion >= 0 && stateVersion < this.lastStateVersion) {
        logger.warn('state_version_regression', {
          previous: this.lastStateVersion,
          next: stateVersion
        });
      }
      if (stateVersion >= 0) {
        this.lastStateVersion = stateVersion;
      }

      if (this.pendingMultiplayerAction && !this.gameStore?.isMyTurn) {
        logger.debug('pending_action_released_on_turn_change');
        this.pendingMultiplayerAction = null;
        this.isProcessing = false;
        this.updateButtonStates();
      }

      this.maybeStartMultiplayerFlow();
      if (!this.multiplayerFlowStarted) {
        this.render();
        return;
      }

      this.processNewMultiplayerActions();

      const hasAmmoData = (game.shotgun?.totalRounds || 0) > 0;
      const isNewRound =
        this.lastRevealedRoundNumber === null ||
        this.lastRevealedRoundNumber !== nextState.roundNumber;

      if (hasAmmoData && isNewRound) {
        this.lastRevealedRoundNumber = nextState.roundNumber;
        this.firedShots = [];
        this.nextAmmoRevealed = null;
        this.gun.hideNextAmmo();
        this.round.startTimeout();
        return;
      }

      const canHydrateShots =
        !this.ammoRevealPhase &&
        !this.betweenRounds &&
        !this.isPlayingMultiplayerAction &&
        this.multiplayerActionQueue.length === 0;
      if (canHydrateShots) {
        this.syncFiredShotsFromActionHistory(game);
      }

      if (game.turnNumber !== lastTurnNumber) {
        this.clearTargetSelection();
        logger.info('turn_changed', {
          turnNumber: game.turnNumber,
          localTurnIndex: this.state.currentTurnIndex
        });
        lastTurnNumber = game.turnNumber;
      }

      this.render();
    };

    this.events.on('update', this.multiplayerUpdateHandler);
    this.events.once('shutdown', () => {
      if (this.multiplayerUpdateHandler) {
        this.events.off('update', this.multiplayerUpdateHandler);
        this.multiplayerUpdateHandler = null;
      }
      this.multiplayerActionQueue = [];
      this.isPlayingMultiplayerAction = false;
    });
  }

  /**
   * Process unhandled multiplayer actions from store feed.
   */
  processNewMultiplayerActions() {
    if (!this.isMultiplayer || !this.multiplayerFlowStarted || !Array.isArray(this.gameStore?.gameActions)) return;
    if (!this.processedActionIds) this.processedActionIds = new Set();

    const pending = [];
    for (const action of this.gameStore.gameActions) {
      if (!action?.id || this.processedActionIds.has(action.id)) continue;
      this.processedActionIds.add(action.id);
      if (this.currentMatchId && action.matchId && action.matchId !== this.currentMatchId) {
        logger.debug('action_skipped_foreign_match', {
          actionId: action.id,
          actionMatchId: action.matchId,
          currentMatchId: this.currentMatchId
        });
        continue;
      }

      this.acknowledgePendingMultiplayerAction(action);

      const actionStateVersion = Number(action.stateVersion);
      const hasActionStateVersion = Number.isFinite(actionStateVersion);
      const isBootstrapHistory =
        hasActionStateVersion &&
        this.bootstrapStateVersion >= 0 &&
        actionStateVersion <= this.bootstrapStateVersion;
      if (isBootstrapHistory) {
        continue;
      }

      pending.push(action);
    }

    if (pending.length > 0) {
      pending.sort((a, b) => {
        const av = Number.isFinite(Number(a.stateVersion)) ? Number(a.stateVersion) : Number.MAX_SAFE_INTEGER;
        const bv = Number.isFinite(Number(b.stateVersion)) ? Number(b.stateVersion) : Number.MAX_SAFE_INTEGER;
        if (av !== bv) return av - bv;
        return this.timestampToMillis(a.timestamp) - this.timestampToMillis(b.timestamp);
      });

      this.multiplayerActionQueue.push(...pending);
      if (this.multiplayerActionQueue.length > 200) {
        this.multiplayerActionQueue.splice(0, this.multiplayerActionQueue.length - 200);
      }

      void this.playQueuedMultiplayerActions();
    }

    this.releaseStalePendingAction();
  }

  /**
   * Convert timestamp-like values to epoch milliseconds.
   * @param {any} value - Firestore timestamp-like value.
   * @returns {number}
   */
  timestampToMillis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') {
      return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1_000_000);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Read last seen reveal marker from local storage.
   * @returns {{matchId: string, roundNumber: number} | null}
   */
  getSeenRoundRevealMarker() {
    try {
      const rawCurrent = localStorage.getItem(REVEAL_SEEN_STORAGE_KEY);
      const rawLegacy = localStorage.getItem(LEGACY_REVEAL_SEEN_STORAGE_KEY);
      const raw = rawCurrent || rawLegacy;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const roundNumber = Number(parsed?.roundNumber);
      if (!parsed?.matchId || !Number.isFinite(roundNumber) || roundNumber <= 0) {
        return null;
      }
      if (!rawCurrent && rawLegacy) {
        localStorage.setItem(REVEAL_SEEN_STORAGE_KEY, rawLegacy);
        localStorage.removeItem(LEGACY_REVEAL_SEEN_STORAGE_KEY);
      }
      return {
        matchId: String(parsed.matchId),
        roundNumber
      };
    } catch (_err) {
      return null;
    }
  }

  /**
   * Persist reveal marker for current match/round.
   * @param {number} roundNumber - Round number that has been revealed.
   */
  markRoundRevealSeen(roundNumber) {
    const game = this.gameStore?.currentGame;
    const matchId = game?.matchId || this.currentMatchId || null;
    const normalizedRound = Number(roundNumber || game?.currentRound || this.state?.roundNumber || 0);
    if (!matchId || !Number.isFinite(normalizedRound) || normalizedRound <= 0) return;

    try {
      localStorage.setItem(REVEAL_SEEN_STORAGE_KEY, JSON.stringify({
        matchId,
        roundNumber: normalizedRound
      }));
    } catch (_err) {
      // Ignore storage quota/private mode failures.
    }
  }

  /**
   * Return true when reveal for a specific match round was already seen by this client.
   * @param {string | null} matchId - Match identifier.
   * @param {number} roundNumber - Round number.
   * @returns {boolean}
   */
  hasSeenRoundReveal(matchId, roundNumber) {
    if (!matchId) return false;
    const marker = this.getSeenRoundRevealMarker();
    if (!marker) return false;
    return marker.matchId === matchId && Number(marker.roundNumber) === Number(roundNumber);
  }

  /**
   * Get current match action feed sorted deterministically.
   * @param {object | null} game - Game snapshot.
   * @returns {Array<object>}
   */
  getSortedCurrentMatchActions(game = this.gameStore?.currentGame) {
    const actions = Array.isArray(this.gameStore?.gameActions) ? [...this.gameStore.gameActions] : [];
    const matchId = game?.matchId || this.currentMatchId || null;

    const filtered = actions.filter((action) => {
      if (!action?.id) return false;
      if (!matchId) return true;
      return !action.matchId || action.matchId === matchId;
    });

    filtered.sort((a, b) => {
      const av = Number.isFinite(Number(a.stateVersion)) ? Number(a.stateVersion) : Number.MAX_SAFE_INTEGER;
      const bv = Number.isFinite(Number(b.stateVersion)) ? Number(b.stateVersion) : Number.MAX_SAFE_INTEGER;
      if (av !== bv) return av - bv;
      return this.timestampToMillis(a.timestamp) - this.timestampToMillis(b.timestamp);
    });

    return filtered;
  }

  /**
   * Rebuild consumed round history (live/blank) for the active round from authoritative actions.
   * @param {object | null} game - Game snapshot.
   * @returns {Array<{wasLive: boolean, damage: number}>}
   */
  buildFiredShotsFromActionHistory(game = this.gameStore?.currentGame) {
    if (!game) return [];

    const currentRound = Number(game.currentRound || this.state?.roundNumber || 1);
    const actions = this.getSortedCurrentMatchActions(game);
    const rebuilt = [];

    for (const action of actions) {
      const result = action?.result || {};
      const roundBefore = Number(result.roundBefore ?? action.roundNumber ?? currentRound);
      if (roundBefore !== currentRound) continue;

      if (action.type === 'shoot') {
        if (result.roundType === 'live' || result.roundType === 'blank') {
          rebuilt.push({
            wasLive: result.roundType === 'live',
            damage: Number(result.damage) || 0
          });
        }
        continue;
      }

      if (action.type === 'item_use') {
        if (result.ejectedRound === 'live' || result.ejectedRound === 'blank') {
          rebuilt.push({
            wasLive: result.ejectedRound === 'live',
            damage: 0
          });
        }
      }
    }

    return rebuilt;
  }

  /**
   * Reconcile local fired shot visuals with authoritative action history.
   * @param {object | null} game - Game snapshot.
   * @returns {boolean} True when local display state changed.
   */
  syncFiredShotsFromActionHistory(game = this.gameStore?.currentGame) {
    if (!game) return false;

    const rebuilt = this.buildFiredShotsFromActionHistory(game);
    const sameShots =
      rebuilt.length === this.firedShots.length &&
      rebuilt.every((shot, index) => shot.wasLive === this.firedShots[index]?.wasLive);

    const myUserId = this.getMyUserId();
    const revealOwnerId = game.turnContext?.playerId || game.players?.[game.currentTurn]?.userId || null;
    const revealedRound = game.turnContext?.revealedRound;
    const restoredReveal =
      revealOwnerId === myUserId && (revealedRound === 'live' || revealedRound === 'blank')
        ? revealedRound
        : null;

    const sameReveal = this.nextAmmoRevealed === restoredReveal;
    if (sameShots && sameReveal) return false;

    if (!sameShots) {
      this.firedShots = rebuilt;
    }

    this.nextAmmoRevealed = restoredReveal;
    if (!restoredReveal) {
      this.gun.hideNextAmmo();
    }

    return true;
  }

  /**
   * Determine whether initial round reveal should play for this scene bootstrap.
   * @param {object | null} game - Game snapshot.
   * @returns {boolean}
   */
  shouldPlayInitialRoundReveal(game = this.gameStore?.currentGame) {
    if (!game) return false;

    const roundNumber = Number(game.currentRound || this.state?.roundNumber || 1);
    const turnNumber = Number(game.turnNumber || 0);
    const totalRounds = Number(game.shotgun?.totalRounds || 0);
    const chamberLength = Number(game.shotgun?.chamber?.length || 0);
    const consumedInRound = Math.max(0, totalRounds - chamberLength);
    const matchId = game.matchId || this.currentMatchId || null;

    if (this.hasSeenRoundReveal(matchId, roundNumber)) {
      return false;
    }

    return turnNumber === 0 && consumedInRound === 0;
  }

  /**
   * Wait helper based on Phaser's scene clock.
   * @param {number} ms - Delay in milliseconds.
   * @returns {Promise<void>}
   */
  waitForMs(ms) {
    return new Promise((resolve) => {
      this.time.delayedCall(Math.max(0, ms), () => resolve());
    });
  }

  /**
   * Play queued server-confirmed actions in deterministic order.
   * @returns {Promise<void>}
   */
  async playQueuedMultiplayerActions() {
    if (this.isPlayingMultiplayerAction) return;
    if (!this.multiplayerFlowStarted) return;

    this.isPlayingMultiplayerAction = true;

    try {
      while (this.multiplayerActionQueue.length > 0) {
        const action = this.multiplayerActionQueue.shift();
        if (!action) continue;

        const actionTsMs = this.timestampToMillis(action.timestamp);
        if (actionTsMs > 0) {
          const scheduledAt = actionTsMs + MULTIPLAYER_ACTION_SYNC_LEAD_MS;
          const waitMs = Math.max(0, scheduledAt - Date.now());
          if (waitMs > 0) {
            await this.waitForMs(waitMs);
          }
        }

        const durationMs = this.animateMultiplayerAction(action) || MULTIPLAYER_ACTION_FALLBACK_DURATION_MS;
        this.render();
        if (durationMs > 0) {
          await this.waitForMs(durationMs);
        }
      }
    } finally {
      this.isPlayingMultiplayerAction = false;
    }
  }

  /**
   * Release pending input lock if server ack did not arrive in time.
   */
  releaseStalePendingAction() {
    if (!this.pendingMultiplayerAction) return;

    const ageMs = Date.now() - this.pendingMultiplayerAction.sentAtMs;
    if (ageMs < MULTIPLAYER_ACTION_ACK_TIMEOUT_MS) return;

    logger.warn('pending_action_timeout_release', {
      actionType: this.pendingMultiplayerAction.type,
      item: this.pendingMultiplayerAction.item,
      ageMs
    });

    this.pendingMultiplayerAction = null;
    this.isProcessing = false;
    this.updateButtonStates();
  }

  /**
   * Unlock local action gate once server confirms action in action stream.
   * @param {object} action - Action doc entry.
   */
  acknowledgePendingMultiplayerAction(action) {
    if (!this.pendingMultiplayerAction) return;

    const myUserId = this.getMyUserId();
    if (!myUserId || action?.playerId !== myUserId) return;

    if (!this.isMatchingPendingAction(action, this.pendingMultiplayerAction)) return;

    logger.info('pending_action_acknowledged', {
      actionId: action.id,
      type: action.type,
      item: action.itemUsed || null
    });

    this.pendingMultiplayerAction = null;
    this.isProcessing = false;
    this.updateButtonStates();
  }

  /**
   * Check whether incoming server action corresponds to pending local action.
   * @param {object} serverAction - Server action entry.
   * @param {object} pending - Pending local action.
   * @returns {boolean}
   */
  isMatchingPendingAction(serverAction, pending) {
    if (!serverAction || !pending) return false;

    const expectedType = pending.type === 'USE_ITEM' ? 'item_use' : 'shoot';
    if (serverAction.type !== expectedType) return false;

    if (pending.type === 'USE_ITEM' && pending.item) {
      return this.normalizeItemKey(serverAction.itemUsed) === this.normalizeItemKey(pending.item);
    }

    return true;
  }

  /**
   * Render multiplayer action feedback from server-confirmed action entries.
   * @param {object} action - Server action entry.
   */
  animateMultiplayerAction(action) {
    const myUserId = this.getMyUserId();
    if (!myUserId || !action) return 0;

    const actorIndex = this.state.players.findIndex(
      player => player.userId === action.playerId || player.id === action.playerId
    );
    const localIndex = this.getLocalPlayerIndex();
    const actorIsMe = action.playerId === myUserId || actorIndex === localIndex;
    const actorId = actorIsMe ? 'YOU' : 'BOT';
    const resolvedActorIndex = actorIndex >= 0 ? actorIndex : (actorIsMe ? localIndex : 1);
    const result = action.result || {};

    logger.info('action_stream_event', {
      actionId: action.id,
      type: action.type,
      actor: actorIsMe ? 'YOU' : 'OPPONENT',
      matchId: action.matchId || null,
      stateVersion: action.stateVersion ?? null,
      targetId: action.targetId || null,
      result
    });

    if (action.type === 'shoot') {
      const targetIndex = this.state.players.findIndex(
        player => player.userId === action.targetId || player.id === action.targetId
      );
      const fallbackOpponentIndex = this.state.players.findIndex((player, idx) => idx !== localIndex && player.alive);
      const resolvedTargetIndex = targetIndex >= 0
        ? targetIndex
        : (action.targetId === myUserId ? localIndex : (fallbackOpponentIndex >= 0 ? fallbackOpponentIndex : localIndex));
      const shotType = resolvedTargetIndex === resolvedActorIndex ? 'SHOOT_SELF' : 'SHOOT_PLAYER';
      const wasLive = result.roundType === 'live';
      const shouldShowGunImpact = resolvedTargetIndex === localIndex;

      this.action.showActionIndicator(actorId, shotType);
      this.gun.rotateToTarget(resolvedTargetIndex, () => {
        this.effects.playShootEffect(wasLive, { type: shotType });
        this.effects.playGunImpactEffect({
          targetIndex: resolvedTargetIndex,
          wasLive,
          shouldDisplay: shouldShowGunImpact
        });
        this.sound.play(wasLive ? 'sndGunshot' : 'sndDryFire');

        if (wasLive && (result.damage || 0) > 0) {
          this.effects.playDamageEffect(resolvedTargetIndex);
        }

        this.time.delayedCall(220, () => {
          this.gun.resetToNeutral();
          this.gun.resetKnifeVisuals();
        });
      });

      this.firedShots.push({
        wasLive,
        damage: result.damage || 0
      });
      const roundAdvancedByShot = Number(result.roundAfter) !== Number(result.roundBefore);
      if (roundAdvancedByShot) {
        this.firedShots = [];
      }
      this.nextAmmoRevealed = null;
      this.gun.hideNextAmmo();
      if (actorIsMe) {
        this.clearTargetSelection();
      }
      logger.debug('action_stream_shoot_result', {
        actionId: action.id,
        actorId,
        targetId: action.targetId,
        roundType: result.roundType || null,
        damage: result.damage || 0,
        actorHealthAfter: result.actorHealthAfter,
        targetHealthAfter: result.targetHealthAfter,
        chamberAfter: result.shotgunAfter?.chamberLength,
        liveAfter: result.shotgunAfter?.liveRounds,
        blankAfter: result.shotgunAfter?.blankRounds,
        turnAfter: result.turnAfter,
        roundAfter: result.roundAfter,
        gameEnded: !!result.gameEnded
      });
      return 1000;
    }

    if (action.type === 'item_use') {
      const itemKey = this.normalizeItemKey(action.itemUsed);
      this.action.showActionIndicator(actorId, 'USE_ITEM', itemKey);
      this.effects.playItemEffect(itemKey, actorId);

      if (itemKey === ITEM_KEYS.BEER) {
        const ejected = result.ejectedRound;
        if (ejected === 'live' || ejected === 'blank') {
          const wasLive = ejected === 'live';
          this.firedShots.push({ wasLive, damage: 0 });
          const roundAdvancedByBeer = Number(result.roundAfter) !== Number(result.roundBefore);
          if (roundAdvancedByBeer) {
            this.firedShots = [];
          }
          this.effects.playBeerEffect(wasLive);
        }
      } else if (itemKey === ITEM_KEYS.CIGARETTE) {
        this.effects.playHealEffect(resolvedActorIndex);
      } else if (itemKey === ITEM_KEYS.HANDCUFFS) {
        const targetIndex = this.state.players.findIndex(
          player => player.userId === action.targetId || player.id === action.targetId
        );
        if (targetIndex >= 0) {
          this.effects.playHandcuffEffect(targetIndex);
        }
        if (actorIsMe) {
          this.clearTargetSelection();
        }
      } else if (itemKey === ITEM_KEYS.KNIFE) {
        this.effects.playKnifeEffect();
      } else if (itemKey === ITEM_KEYS.MAGNIFYING_GLASS) {
        const revealed = result.revealedRound;
        if (actorIsMe && (revealed === 'live' || revealed === 'blank')) {
          this.nextAmmoRevealed = revealed;
        }
      }

      logger.debug('action_stream_item_result', {
        actionId: action.id,
        actorId,
        item: itemKey,
        targetId: action.targetId || null,
        targetPendingSkipsAfter: result.targetPendingSkipsAfter ?? null,
        revealedRound: result.revealedRound || null,
        ejectedRound: result.ejectedRound || null,
        actorHealthAfter: result.actorHealthAfter,
        chamberAfter: result.shotgunAfter?.chamberLength,
        liveAfter: result.shotgunAfter?.liveRounds,
        blankAfter: result.shotgunAfter?.blankRounds,
        turnAfter: result.turnAfter,
        roundAfter: result.roundAfter
      });
      return 520;
    }

    return MULTIPLAYER_ACTION_FALLBACK_DURATION_MS;
  }

  /**
   * Handle player selection in multiplayer target UI.
   * @param {number} index - Selected player index.
   * @param {string} userId - Selected user id.
   */
  onPlayerSelected(index, userId) {
    if (!this.isMultiplayer) return;
    if (!this.canSelectTarget()) return;

    const targetPlayer = this.state?.players?.[index];
    if (!targetPlayer?.alive) return;
    const resolvedUserId = targetPlayer.userId || userId;
    if (!resolvedUserId) return;

    if (this.isAwaitingHandcuffTargetSelection()) {
      const myUserId = this.getMyUserId();
      if (resolvedUserId === myUserId) return;

      logger.debug('handcuff_target_selected', { userId: resolvedUserId, index });
      this.targetedIndex = index;
      this.selectedTargetId = resolvedUserId;
      this.syncTurnTargetSelection(resolvedUserId, 'item');
      this.pendingMultiplayerItemSelection = null;
      this.isProcessing = true;
      this.updateButtonStates();

      void this.executeMultiplayerAction({
        type: 'USE_ITEM',
        item: ITEM_KEYS.HANDCUFFS,
        targetId: resolvedUserId
      });
      return;
    }

    logger.debug('target_selected', { userId: resolvedUserId, index });

    if (this.selectedTargetId === resolvedUserId) {
      this.targetedIndex = null;
      this.selectedTargetId = null;
    } else {
      this.targetedIndex = index;
      this.selectedTargetId = resolvedUserId;
    }
    this.syncTurnTargetSelection(this.selectedTargetId || null, this.selectedTargetId ? 'shoot' : null);

    this.render();
    this.updateButtonStates();
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  update() {
    if (this.maskGraphicsMap) {
      this.maskGraphicsMap.forEach((graphics, container) => {
        graphics.x = container.x;
        graphics.y = container.y;
      });
    }

    if (this.isMultiplayer && this.state && this.players?.updateAfkBadges) {
      const now = Date.now();
      if (!this.lastAfkUiSyncAtMs || (now - this.lastAfkUiSyncAtMs) >= 350) {
        this.players.updateAfkBadges(this.state);
        this.lastAfkUiSyncAtMs = now;
      }
    }
  }

  /**
   * Check whether local user can execute a gameplay action now.
   * @returns {boolean}
   */
  canTakeTurnAction() {
    if (this.state?.gameOver || this.ammoRevealPhase || this.betweenRounds) return false;

    if (!this.isMultiplayer) {
      return this.state?.players?.[this.state.currentTurnIndex]?.id === 'YOU';
    }

    return !!(
      this.gameStore?.isMyTurn &&
      this.gameStore?.amAlive &&
      this.gameStore?.startGateOpen &&
      this.multiplayerFlowStarted
    );
  }

  /**
   * Check whether avatar target selection is currently allowed.
   * @returns {boolean}
   */
  canSelectTarget() {
    if (!this.isMultiplayer) return false;
    return this.canTakeTurnAction() && !this.isProcessing;
  }

  /**
   * True while handcuffs are selected and a target is required.
   * @returns {boolean}
   */
  isAwaitingHandcuffTargetSelection() {
    return this.isMultiplayer && this.pendingMultiplayerItemSelection === ITEM_KEYS.HANDCUFFS;
  }

  /**
   * Clear selected target and avatar highlight.
   */
  clearTargetSelection() {
    this.targetedIndex = null;
    this.selectedTargetId = null;
  }

  /**
   * Sync selected target in shared turn context for multiplayer visibility.
   * @param {string | null} targetUserId - Selected target user id.
   * @param {'shoot' | 'item' | null} targetMode - Selection mode.
   */
  syncTurnTargetSelection(targetUserId = null, targetMode = null) {
    if (!this.isMultiplayer || !this.gameStore?.setTurnTarget) return;

    void this.gameStore.setTurnTarget(targetUserId || null, targetMode || null).catch((err) => {
      logger.debug('turn_target_sync_failed', {
        targetId: targetUserId || null,
        targetMode: targetMode || null,
        error: err?.message || String(err)
      });
    });
  }

  /**
   * Get turn target from authoritative multiplayer state.
   * @returns {string | null}
   */
  getSyncedTurnTargetId() {
    if (!this.isMultiplayer) return null;
    return this.gameStore?.currentGame?.turnContext?.targetPlayerId || null;
  }

  /**
   * Get turn target mode from authoritative multiplayer state.
   * @returns {'shoot' | 'item' | null}
   */
  getSyncedTurnTargetMode() {
    if (!this.isMultiplayer) return null;
    const mode = this.gameStore?.currentGame?.turnContext?.targetMode;
    return mode === 'shoot' || mode === 'item' ? mode : null;
  }

  /**
   * Resolve local mapped player index from target user id.
   * @param {string | null} targetUserId - Target user id.
   * @returns {number | null}
   */
  resolveTargetIndexFromUserId(targetUserId) {
    if (!targetUserId || !this.state?.players?.length) return null;

    const index = this.state.players.findIndex(player =>
      player.alive && (player.userId === targetUserId || player.id === targetUserId)
    );
    return index >= 0 ? index : null;
  }

  /**
   * Resolve which target highlight should be rendered.
   * Local interactive selection has priority; otherwise use synchronized turn target.
   * @returns {number | null}
   */
  resolveDisplayedTargetIndex() {
    const localTargetId = this.canSelectTarget() ? (this.selectedTargetId || null) : null;
    const targetId = localTargetId || this.getSyncedTurnTargetId();
    return this.resolveTargetIndexFromUserId(targetId);
  }

  /**
   * Resolve which target should receive danger overlay.
   * Overlay is restricted to shoot targeting mode only.
   * @returns {number | null}
   */
  resolveDangerTargetIndex() {
    if (!this.state?.players?.length) return null;

    const myUserId = this.getMyUserId();
    if (!myUserId) return null;

    const hasLocalSelection = this.canSelectTarget() && !!this.selectedTargetId;
    const localMode = hasLocalSelection
      ? (this.isAwaitingHandcuffTargetSelection() ? 'item' : 'shoot')
      : null;
    const localTargetId = hasLocalSelection ? this.selectedTargetId : null;

    const syncedTargetId = this.getSyncedTurnTargetId();
    const syncedMode = this.getSyncedTurnTargetMode();

    const effectiveMode = localMode || syncedMode;
    const effectiveTargetId = localTargetId || syncedTargetId;
    const actorUserId = this.getTurnActorUserId();

    if (effectiveMode !== 'shoot') return null;
    if (!effectiveTargetId || effectiveTargetId !== myUserId) return null;
    if (!actorUserId || actorUserId === myUserId) return null;

    return this.resolveTargetIndexFromUserId(effectiveTargetId);
  }

  // ==========================================================================
  // PLAYER INPUT
  // ==========================================================================

  /**
   * Handle shoot button actions.
   * @param {object} actionData - Action payload.
   */
  onPlayerAction(actionData) {
    if (this.isProcessing) return;
    if (!this.canTakeTurnAction()) return;

    if (this.isAwaitingHandcuffTargetSelection()) {
      this.pendingMultiplayerItemSelection = null;
    }

    this.isProcessing = true;
    this.updateButtonStates();

    logger.debug('player_action_requested', {
      type: actionData.type,
      targetId: actionData.targetId || null
    });

    if (this.isMultiplayer && actionData.type?.startsWith('SHOOT')) {
      this.clearTargetSelection();
      this.syncTurnTargetSelection(null, null);
      this.updateButtonStates();
    }

    if (this.isMultiplayer && this.gameStore) {
      void this.executeMultiplayerAction(actionData);
      return;
    }

    this.action.execute(actionData, 'YOU');
  }

  /**
   * Handle item button actions.
   * @param {string} item - Item key.
   */
  onItemAction(item) {
    const normalizedItem = this.normalizeItemKey(item);
    if (this.isProcessing) return;
    if (!this.canTakeTurnAction()) return;

    // In multiplayer >2, handcuffs require explicit target selection (cannot self-target).
    if (this.isMultiplayer && normalizedItem === ITEM_KEYS.HANDCUFFS && (this.state?.players?.length || 0) > 2) {
      const nextMode = this.pendingMultiplayerItemSelection === ITEM_KEYS.HANDCUFFS
        ? null
        : ITEM_KEYS.HANDCUFFS;
      this.pendingMultiplayerItemSelection = nextMode;
      if (nextMode) {
        this.clearTargetSelection();
        this.syncTurnTargetSelection(null, null);
      }

      logger.debug('handcuff_target_selection_mode', { active: !!nextMode });
      this.isProcessing = false;
      this.updateButtonStates();
      this.render();
      return;
    }

    if (this.pendingMultiplayerItemSelection) {
      this.pendingMultiplayerItemSelection = null;
    }

    this.isProcessing = true;
    this.updateButtonStates();

    logger.debug('item_action_requested', { item: normalizedItem });

    if (this.isMultiplayer && this.gameStore) {
      void this.executeMultiplayerAction({ type: 'USE_ITEM', item: normalizedItem });
      return;
    }

    const actionData = { type: 'USE_ITEM', item: normalizedItem };
    if (normalizedItem === ITEM_KEYS.HANDCUFFS) {
      const targetPlayer = this.state.players.find(p => p.id !== 'YOU' && p.alive);
      actionData.targetId = targetPlayer?.id || targetPlayer?.userId || 'BOT';
    }

    this.action.execute(actionData, 'YOU');
  }

  /**
   * Dispatch multiplayer action through the store.
   * Unlock is performed only when action ack arrives from action feed.
   * @param {object} actionData - Action payload.
   */
  async executeMultiplayerAction(actionData) {
    try {
      const myUserId = this.getMyUserId();
      this.pendingMultiplayerAction = {
        type: actionData.type,
        item: actionData.item || null,
        sentAtMs: Date.now()
      };

      logger.info('multiplayer_action_send', {
        type: actionData.type,
        item: actionData.item || null
      });

      if (actionData.type === 'SHOOT_PLAYER') {
        let targetUserId = actionData.targetId;
        if (!targetUserId) {
          targetUserId = this.selectedTargetId;
        }

        if (!targetUserId) {
          logger.error('shoot_target_resolution_failed');
          const opponent = this.gameStore.currentGame.players.find(
            player => player.userId !== myUserId && player.isAlive !== false
          );
          targetUserId = opponent?.userId;
        }

        await this.gameStore.performShoot(targetUserId);
      } else if (actionData.type === 'SHOOT_SELF') {
        await this.gameStore.performShoot(myUserId);
      } else if (actionData.type === 'USE_ITEM') {
        const normalizedItem = this.normalizeItemKey(actionData.item);
        const storeItemKey = this.toStoreItemKey(normalizedItem);

        let targetUserId = actionData.targetId || null;
        if (!targetUserId && storeItemKey === ITEMS.HANDCUFFS) {
          targetUserId = this.selectedTargetId;
        }
        if (!targetUserId && storeItemKey === ITEMS.HANDCUFFS) {
          const playerCount = this.gameStore?.currentGame?.players?.length || 0;
          if (playerCount > 2) {
            throw new Error('Target required');
          }
          targetUserId = this.gameStore.currentGame.players.find(
            player => player.userId !== myUserId && player.isAlive !== false
          )?.userId || null;
        }

        await this.gameStore.useItem(storeItemKey, targetUserId);
      }

      logger.debug('multiplayer_action_dispatched', { type: actionData.type });
    } catch (err) {
      logger.error('multiplayer_action_failed', {
        type: actionData.type,
        error: err?.message || String(err)
      });

      this.pendingMultiplayerItemSelection = null;
      this.pendingMultiplayerAction = null;
      this.isProcessing = false;
      this.updateButtonStates();
    }
  }

  /**
   * Execute local action (used by AI in single-player mode).
   * @param {object} actionData - Action payload.
   * @param {string} actorId - Actor id.
   */
  executeAction(actionData, actorId) {
    this.action.execute(actionData, actorId);
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  updateButtonStates() {
    this.ui.updateButtonStates(this.state, this.isProcessing, this.ammoRevealPhase, this.betweenRounds);
    if (this.players?.setSelectionEnabled) {
      this.players.setSelectionEnabled(this.canSelectTarget());
    }
  }

  /**
   * Resolve which non-local player items should be shown in the top item rail.
   * Priority: selected target, current turn actor, then first alive opponent.
   * @returns {number}
   */
  getSecondaryDisplayPlayerIndex() {
    if (!this.state?.players?.length || this.state.players.length < 2) return -1;

    if (this.selectedTargetId) {
      const selectedIdx = this.state.players.findIndex(player =>
        player.alive && (player.userId === this.selectedTargetId || player.id === this.selectedTargetId)
      );
      if (selectedIdx > 0) return selectedIdx;
    }

    if (this.state.currentTurnIndex > 0 && this.state.players[this.state.currentTurnIndex]?.alive) {
      return this.state.currentTurnIndex;
    }

    return this.state.players.findIndex((player, idx) => idx > 0 && player.alive);
  }

  render() {
    if (!this.canTakeTurnAction() && this.pendingMultiplayerItemSelection) {
      this.pendingMultiplayerItemSelection = null;
    }

    if (this.isMultiplayer) {
      const hasAliveTarget = (targetId) => this.state.players.some(
        player => player.alive && (player.userId === targetId || player.id === targetId)
      );

      if (this.selectedTargetId && !hasAliveTarget(this.selectedTargetId)) {
        this.clearTargetSelection();
      }
    }

    if (!this.canSelectTarget() && (this.selectedTargetId || this.targetedIndex !== null)) {
      this.clearTargetSelection();
    }

    if (this.state?.shotgun?.damage !== 2) {
      this.gun.resetKnifeVisuals();
    }

    const displayedTargetIndex = this.resolveDisplayedTargetIndex();
    const dangerTargetIndex = this.resolveDangerTargetIndex();
    this.updateDangerScreenEffect(dangerTargetIndex);
    this.players.updateAvatarStates(this.state, displayedTargetIndex, null);
    this.players.renderHearts(this.state);
    this.hud.update(this.state);
    this.ammo.render(
      this.roundStartTotal,
      this.roundStartLive,
      this.firedShots,
      this.ammoRevealPhase,
      this.nextAmmoRevealed
    );
    this.updateButtonStates();

    const canUseItems = !this.ammoRevealPhase && !this.betweenRounds;

    if (this.isMultiplayer) {
      const localIndex = this.getLocalPlayerIndex();
      const canActWithItems = canUseItems && this.canTakeTurnAction() && !this.isProcessing;

      this.state.players.forEach((player, index) => {
        const container = this.players.getItemsContainer(index);
        if (!container) return;

        const alive = player.alive !== false && player.health > 0;
        if (!alive) {
          this.items.render(container, [], false, false, this.ammoRevealPhase, this.betweenRounds);
          return;
        }

        const interactive = index === localIndex ? canActWithItems : false;
        this.items.render(
          container,
          player.items || [],
          interactive,
          false,
          this.ammoRevealPhase,
          this.betweenRounds
        );
      });
    } else {
      this.items.render(
        this.ui.getPlayerItemsContainer(),
        this.state.players[0].items,
        canUseItems,
        false,
        this.ammoRevealPhase,
        this.betweenRounds
      );

      const secondaryIndex = this.getSecondaryDisplayPlayerIndex();
      const secondaryItems = secondaryIndex >= 0 ? (this.state.players[secondaryIndex]?.items || []) : [];
      this.items.render(
        this.ui.getBotItemsContainer(),
        secondaryItems,
        false,
        true,
        this.ammoRevealPhase,
        this.betweenRounds
      );
    }

    if (this.state.gameOver && !this.restartBtn) {
      this.handleGameOver();
    }
  }

  // ==========================================================================
  // GAME OVER
  // ==========================================================================

  handleGameOver() {
    const layout = this.getLayout();
    const winner = this.state.players.find(player => player.alive);
    const myUserId = this.getMyUserId();
    const isWin = !!winner && (winner.userId === myUserId || winner.id === 'YOU');

    logger.info('game_over', { winnerId: winner?.id || null });

    const gameOverScreen = this.registry.get('gameOverScreen');
    if (gameOverScreen) {
      this.time.delayedCall(500, () => {
        gameOverScreen.show(
          isWin,
          this.playerName,
          () => this.scene.restart({ playerName: this.playerName }),
          () => window.location.reload()
        );
      });
    }

    const overlay = this.add.rectangle(layout.CENTER_X, layout.HEIGHT / 2, layout.WIDTH, layout.HEIGHT, 0x000000, 0.7)
      .setDepth(100);

    this.tweens.add({
      targets: overlay,
      alpha: 0.7,
      duration: 300
    });

    this.restartBtn = true;
  }

  // ==========================================================================
  // BACKWARD COMPATIBILITY ACCESSORS
  // ==========================================================================

  get playerContainers() {
    return this.players.getContainers();
  }

  get gunSprite() {
    return this.gun.getGunSprite();
  }

  get crossedRevolversSprite() {
    return this.gun.getCrossedRevolversSprite();
  }

  /**
   * Bridge for legacy effect triggers.
   * @param {string} type - Effect type.
   * @param {object} params - Effect payload.
   */
  triggerEffect(type, params) {
    this.effects.triggerEffect(type, params);
  }
}
