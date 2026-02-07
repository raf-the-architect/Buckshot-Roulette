/**
 * GameScene.js
 * Main gameplay scene orchestrating local rendering and multiplayer synchronization.
 */

import { createInitialState, refillShotgun, giveItems, ITEM_KEYS } from './gameLogic.js';
import { ASSETS, SOUNDS, AVATAR_KEYS } from './LayoutConfig.js';
import { getLayout, getScale } from './ResponsiveLayout.js';
import { useAuthStore } from '@/stores/authStore';
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

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');

    this.isMultiplayer = false;
    this.gameStore = null;
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

    this.multiplayerReadyNotified = false;
    this.multiplayerFlowStarted = false;
    this.pendingMultiplayerAction = null;
    this.musicStarted = false;
    this.multiplayerActionQueue = [];
    this.isPlayingMultiplayerAction = false;
    this.currentMatchId = this.gameStore?.currentGame?.matchId || null;
    this.lastStateVersion = -1;
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
    if (this.currentUserId) return this.currentUserId;

    try {
      const authStore = useAuthStore();
      if (authStore?.userId) {
        this.currentUserId = authStore.userId;
        return this.currentUserId;
      }
    } catch (_err) {
      // Ignore store bootstrap timing race.
    }

    const fallback = this.gameStore?.myPlayer?.userId || null;
    if (fallback) this.currentUserId = fallback;
    return fallback;
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

  // ==========================================================================
  // PRELOAD
  // ==========================================================================

  preload() {
    this.load.setPath('/assets/');

    this.load.image('bg', ASSETS.BG);
    this.load.image('gun', ASSETS.GUN);
    this.load.image('crossedRevolvers', ASSETS.CROSSED_REVOLVERS);

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

      if (!this.state) {
        logger.warn('multiplayer_state_placeholder_used');
        this.state = this.createPlaceholderState();
      }
    } else {
      logger.info('game_start_singleplayer');
      this.rng = { random: () => Math.random() };
      this.state = createInitialState();
      refillShotgun(this.state, this.rng);
      giveItems(this.state, this.rng);

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
    this.opponentName = null;
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

    this.imageService.createImage(layout.CENTER_X, layout.HEIGHT / 2, 'bg', {
      displayWidth: layout.WIDTH,
      displayHeight: layout.HEIGHT
    });
    this.add.rectangle(layout.CENTER_X, layout.HEIGHT / 2, layout.WIDTH, layout.HEIGHT, 0x000000, 0.25);

    this.hud.setup();

    const opponentName = this.getOpponentName();
    this.players.setup(this.playerName);
    if (this.isMultiplayer && opponentName && opponentName !== 'Dealer') {
      this.players.updateOpponentName(opponentName);
    }

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

    if (this.gameStore?.setClientRevealPhaseActive) {
      this.gameStore.setClientRevealPhaseActive(true);
    }

    this.startMusicIfNeeded();

    logger.info('multiplayer_flow_started', {
      roundNumber: this.state?.roundNumber,
      turnIndex: this.state?.currentTurnIndex
    });

    const hasAmmoData = (this.roundStartTotal || 0) > 0;
    if (hasAmmoData) {
      this.lastRevealedRoundNumber = this.state.roundNumber;
      this.round.startAmmoReveal();
      return;
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

    const myIndex = game.players.findIndex(p => p.userId === myUserId);
    const opponentIndex = game.players.findIndex(p => p.userId !== myUserId);

    if (myIndex === -1 || opponentIndex === -1) {
      logger.warn('state_map_player_index_missing');
      return null;
    }

    const myPlayer = game.players[myIndex];
    const opponent = game.players[opponentIndex];
    this.opponentName = opponent.displayName || 'Opponent';

    const localTurnIndex = game.currentTurn === myIndex ? 0 : 1;

    return {
      currentTurnIndex: localTurnIndex,
      shotgun: {
        chamber: game.shotgun?.chamber || [],
        damage: game.shotgun?.isSawedOff ? 2 : 1,
        live: game.shotgun?.liveRounds || 0,
        blank: game.shotgun?.blankRounds || 0,
        nextRoundRevealed: false
      },
      players: [
        {
          id: 'YOU',
          userId: myPlayer.userId,
          health: myPlayer.health,
          maxHealth: myPlayer.maxHealth || 4,
          items: (myPlayer.items || []).map(item => this.normalizeItemKey(item)),
          turnsWaiting: 0,
          alive: myPlayer.isAlive !== false
        },
        {
          id: 'OPPONENT',
          userId: opponent.userId,
          displayName: opponent.displayName,
          health: opponent.health,
          maxHealth: opponent.maxHealth || 4,
          items: (opponent.items || []).map(item => this.normalizeItemKey(item)),
          turnsWaiting: 0,
          alive: opponent.isAlive !== false
        }
      ],
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
        { id: 'YOU', userId: this.currentUserId, health: 4, items: [], turnsWaiting: 0, alive: true },
        { id: 'OPPONENT', health: 4, items: [], turnsWaiting: 0, alive: true }
      ],
      gameOver: false,
      roundNumber: 1,
      logs: []
    };
  }

  /**
   * Resolve opponent display name.
   * @returns {string}
   */
  getOpponentName() {
    if (!this.isMultiplayer) return 'Dealer';
    if (!this.gameStore?.currentGame?.players) return 'Opponent';

    const myUserId = this.getMyUserId();
    const opponent = this.gameStore.currentGame.players.find(p => p.userId !== myUserId);
    return opponent?.displayName || 'Opponent';
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
        shotgun: {
          chamberLength: game.shotgun?.chamber?.length || 0,
          totalRounds: game.shotgun?.totalRounds || 0,
          liveRounds: game.shotgun?.liveRounds || 0,
          blankRounds: game.shotgun?.blankRounds || 0,
          isSawedOff: !!game.shotgun?.isSawedOff
        },
        players: (game.players || []).map(p => ({
          userId: p.userId,
          health: p.health,
          isAlive: p.isAlive,
          items: p.items || []
        }))
      });

      if (stateHash === lastStateHash) {
        this.processNewMultiplayerActions();
        this.releaseStalePendingAction();
        this.maybeStartMultiplayerFlow();
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

      if (this.opponentName && this.players.playerContainers?.[1]) {
        this.players.updateOpponentName(this.opponentName);
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
        this.round.startAmmoReveal();
        return;
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

      pending.push(action);
      this.acknowledgePendingMultiplayerAction(action);
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

    const actorIsMe = action.playerId === myUserId;
    const actorId = actorIsMe ? 'YOU' : 'BOT';
    const actorIndex = actorIsMe ? 0 : 1;
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
      const targetIsMe = action.targetId === myUserId;
      const targetIndex = targetIsMe ? 0 : 1;
      const shotType = targetIndex === actorIndex ? 'SHOOT_SELF' : 'SHOOT_PLAYER';
      const wasLive = result.roundType === 'live';

      this.action.showActionIndicator(actorId, shotType);
      this.gun.rotateToTarget(targetIndex, () => {
        this.effects.playShootEffect(wasLive, { type: shotType });
        this.sound.play(wasLive ? 'sndGunshot' : 'sndDryFire');

        if (wasLive && (result.damage || 0) > 0) {
          this.effects.playDamageEffect(targetIndex);
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
      return 680;
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
        this.effects.playHealEffect(actorIndex);
      } else if (itemKey === ITEM_KEYS.HANDCUFFS) {
        const targetIndex = action.targetId === myUserId ? 0 : 1;
        this.effects.playHandcuffEffect(targetIndex);
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

    logger.debug('target_selected', { userId: resolvedUserId, index });

    if (this.selectedTargetId === resolvedUserId) {
      this.targetedIndex = null;
      this.selectedTargetId = null;
    } else {
      this.targetedIndex = index;
      this.selectedTargetId = resolvedUserId;
    }

    this.render();
    this.updateButtonStates();
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  update() {
    if (!this.maskGraphicsMap) return;

    this.maskGraphicsMap.forEach((graphics, container) => {
      graphics.x = container.x;
      graphics.y = container.y;
    });
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
   * Clear selected target and avatar highlight.
   */
  clearTargetSelection() {
    this.targetedIndex = null;
    this.selectedTargetId = null;
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

    this.isProcessing = true;
    this.updateButtonStates();

    logger.debug('player_action_requested', {
      type: actionData.type,
      targetId: actionData.targetId || null
    });

    if (this.isMultiplayer && actionData.type?.startsWith('SHOOT')) {
      this.clearTargetSelection();
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
    if (this.isProcessing) return;
    if (!this.canTakeTurnAction()) return;

    this.isProcessing = true;
    this.updateButtonStates();

    const normalizedItem = this.normalizeItemKey(item);
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
          const opponent = this.state.players[1];
          targetUserId = opponent.userId;
        }

        if (!targetUserId) {
          logger.error('shoot_target_resolution_failed');
          const opponent = this.gameStore.currentGame.players.find(player => player.userId !== myUserId);
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
          targetUserId = this.gameStore.currentGame.players.find(player => player.userId !== myUserId)?.userId || null;
        }

        await this.gameStore.useItem(storeItemKey, targetUserId);
      }

      logger.debug('multiplayer_action_dispatched', { type: actionData.type });
    } catch (err) {
      logger.error('multiplayer_action_failed', {
        type: actionData.type,
        error: err?.message || String(err)
      });

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

  render() {
    if (this.isMultiplayer && this.selectedTargetId) {
      const selectedExists = this.state.players.some(
        player => player.alive && (player.userId === this.selectedTargetId || player.id === this.selectedTargetId)
      );
      if (!selectedExists) {
        this.clearTargetSelection();
      }
    }

    if (!this.canSelectTarget() && (this.selectedTargetId || this.targetedIndex !== null)) {
      this.clearTargetSelection();
    }

    if (this.state?.shotgun?.damage !== 2) {
      this.gun.resetKnifeVisuals();
    }

    this.players.updateAvatarStates(this.state, this.targetedIndex);
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
    this.items.render(
      this.ui.getPlayerItemsContainer(),
      this.state.players[0].items,
      canUseItems,
      false,
      this.ammoRevealPhase,
      this.betweenRounds
    );

    this.items.render(
      this.ui.getBotItemsContainer(),
      this.state.players[1].items,
      false,
      true,
      this.ammoRevealPhase,
      this.betweenRounds
    );

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
    const isWin = winner?.id === 'YOU';

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
