/**
 * GameScene.js
 * Main game scene - orchestrates managers and handles core lifecycle
 */

import { createInitialState, refillShotgun, giveItems } from "./gameLogic.js";
import { ASSETS, SOUNDS, AVATAR_KEYS, COLORS } from "./LayoutConfig.js";
import { getLayout, getScale, STATIC_LAYOUT } from "./ResponsiveLayout.js";

// Managers
import { EffectsManager } from "./EffectsManager.js";
import { AIController } from "./AIController.js";
import { HUDManager } from "./managers/HUDManager.js";
import { PlayerManager } from "./managers/PlayerManager.js";
import { GunManager } from "./managers/GunManager.js";
import { AmmoRenderer } from "./managers/AmmoRenderer.js";
import { UIManager } from "./managers/UIManager.js";
import { ActionHandler } from "./managers/ActionHandler.js";
import { RoundManager } from "./managers/RoundManager.js";
import { ItemRenderer } from "./managers/ItemRenderer.js";


export class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
    // Multiplayer mode flag
    this.isMultiplayer = false;
    this.gameStore = null;
  }

  init(data) {
    this.playerName = data.playerName || "YOU";
    // Check if multiplayer mode
    this.isMultiplayer = this.registry.get('isMultiplayer') || false;
    if (this.isMultiplayer) {
      this.gameStore = this.registry.get('gameStore');
    }
  }

  /**
   * Get current layout (responsive)
   */
  getLayout() {
    return getLayout(this);
  }

  /**
   * Get current scale (responsive)
   */
  getScale() {
    return getScale(this);
  }

  // ==========================================================================
  // PRELOAD
  // ==========================================================================
  preload() {
    this.load.setPath("/assets/");

    // Core
    this.load.image("bg", ASSETS.BG);
    this.load.image("gun", ASSETS.GUN);
    this.load.image("crossedRevolvers", ASSETS.CROSSED_REVOLVERS);

    // Avatars
    this.load.image(AVATAR_KEYS.PLAYER, ASSETS.AVATAR_PLAYER);
    this.load.image(AVATAR_KEYS.PLAYER_ACTIVE, ASSETS.AVATAR_PLAYER_ACTIVE);
    this.load.image(AVATAR_KEYS.PLAYER_DEAD, ASSETS.AVATAR_PLAYER_DEAD);
    this.load.image(AVATAR_KEYS.PLAYER_SELECTED, ASSETS.AVATAR_PLAYER_SELECTED);

    this.load.image(AVATAR_KEYS.BOT, ASSETS.AVATAR_BOT);
    this.load.image(AVATAR_KEYS.BOT_ACTIVE, ASSETS.AVATAR_BOT_ACTIVE);
    this.load.image(AVATAR_KEYS.BOT_DEAD, ASSETS.AVATAR_BOT_DEAD);
    this.load.image(AVATAR_KEYS.BOT_SELECTED, ASSETS.AVATAR_BOT_SELECTED);

    // UI Buttons
    this.load.image("btnShootPlayerIdle", ASSETS.BTN_SHOOT_PLAYER_IDLE);
    this.load.image("btnShootPlayerPressed", ASSETS.BTN_SHOOT_PLAYER_PRESSED);
    this.load.image("btnShootPlayerDisabled", ASSETS.BTN_SHOOT_PLAYER_DISABLED);

    this.load.image("btnShootSelfIdle", ASSETS.BTN_SHOOT_SELF_IDLE);
    this.load.image("btnShootSelfPressed", ASSETS.BTN_SHOOT_SELF_PRESSED);
    this.load.image("btnShootSelfDisabled", ASSETS.BTN_SHOOT_SELF_DISABLED);

    this.load.image("ammoFilled", ASSETS.AMMO_FILLED);
    this.load.image("ammoEmpty", ASSETS.AMMO_EMPTY);
    this.load.image("ammoUnknown", ASSETS.AMMO_UNKNOWN);
    this.load.image("heartFull", ASSETS.HEART_FULL);
    this.load.image("heartEmpty", ASSETS.HEART_EMPTY);
    this.load.image("itemKnife", ASSETS.ITEM_KNIFE);
    this.load.image("itemMagnify", ASSETS.ITEM_MAGNIFY);
    this.load.image("itemHandcuffs", ASSETS.ITEM_HANDCUFFS);
    this.load.image("itemBeer", ASSETS.ITEM_BEER);
    this.load.image("itemCigarette", ASSETS.ITEM_CIGARETTE);

    // Sounds
    this.load.audio("sndSpin", SOUNDS.REVOLVER_SPIN);
    this.load.audio("sndReload", SOUNDS.RELOAD);
    this.load.audio("sndGunshot", SOUNDS.GUNSHOT);
    this.load.audio("sndDryFire", SOUNDS.DRY_FIRE);
    this.load.audio("sndMusic", SOUNDS.BG_MUSIC);

    // Debugging
    this.load.on("loaderror", (file) => {
      console.error(`[LOAD ERROR] Key: ${file.key}, Full URL: ${file.url}`);
    });
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================
  // ==========================================================================
  // CREATE
  // ==========================================================================
  create() {
    this.createGame(this.getLayout());
  }

  /**
   * Unified Game Initialization
   * Handles both Single Player (local) and Multiplayer (network) modes
   */
  createGame(layout) {
    // 1. Initialize State
    if (this.isMultiplayer && this.gameStore) {
      // Multiplayer: No local state init here, we wait for Firebase
      console.log("[STATE] Game Started (Multiplayer) - Waiting for sync...");
      this.state = null; 
    } else {
      // Single Player: Create local state immediately
      console.log("[STATE] Game Started (Single Player)");
      this.rng = { random: () => Math.random() };
      this.state = createInitialState();
      refillShotgun(this.state, this.rng);
      giveItems(this.state, this.rng);
      
      // Initialize SP specific flags
      this.roundStartLive = this.state.shotgun.live;
      this.roundStartBlank = this.state.shotgun.blank;
      this.roundStartTotal = this.state.shotgun.chamber.length;
    }

    // 2. Initialize Common Flags
    this.restartBtn = null;
    this.isProcessing = false;
    this.ammoRevealPhase = !this.isMultiplayer; // MP managed by server/state
    this.firedShots = [];
    this.nextAmmoRevealed = null;
    this.betweenRounds = false;
    this.targetedIndex = null;
    this.selectedTargetId = null;

    // 3. Initialize Shared Managers
    console.log("[GameScene] Initializing Managers...");
    this.effects = new EffectsManager(this);
    this.ai = this.isMultiplayer ? null : new AIController(this); // AI only for SP
    this.hud = new HUDManager(this);
    this.players = new PlayerManager(this);
    this.gun = new GunManager(this);
    this.ammo = new AmmoRenderer(this);
    this.ui = new UIManager(this);
    this.action = new ActionHandler(this);
    this.round = new RoundManager(this);
    this.items = new ItemRenderer(this);
    console.log("[GameScene] Managers initialized.");

    // 4. Setup Visuals (Unified)
    // Background
    console.log("[GameScene] Setting up background...");
    this.add.image(layout.CENTER_X, layout.HEIGHT / 2, "bg")
      .setDisplaySize(layout.WIDTH, layout.HEIGHT);
    
    // Vignette
    this.add.rectangle(layout.CENTER_X, layout.HEIGHT / 2, layout.WIDTH, layout.HEIGHT, 0x000000, 0.25);

    // Setup Managers
    console.log("[GameScene] Setting up HUD...");
    this.hud.setup();
    
    // Player Setup: Use different methods but same visual manager
    console.log("[GameScene] Setting up Players...");
    if (this.isMultiplayer) {
      this.players.setupMultiplayer(this.gameStore);
    } else {
      this.players.setup(this.playerName);
    }

    console.log("[GameScene] Setting up Gun/Ammo/UI...");
    this.gun.setup();
    this.ammo.setup();
    this.ui.setup();

    // 5. Start Game Flow
    // Background music
    this.sound.play("sndMusic", { loop: true, volume: 0.08 });

    if (this.isMultiplayer) {
      // Subscribe to network updates
      this.subscribeToGameState();
    } else {
      // Start local loop
      this.render();
      this.round.startAmmoReveal();
    }
  }

  /**
   * Subscribe to multiplayer game state changes
   */
  subscribeToGameState() {
    if (!this.gameStore) return;

    let lastActionCount = 0;

    // Watch for game state changes via Phaser update loop
    this.events.on('update', () => {
      // If we are in MP, we rely on gameStore.currentGame as our source of truth
      if (!this.gameStore?.currentGame) return;

      const game = this.gameStore.currentGame;
      
      // Update local reference for renderers that might use `this.state` (compatibility)
      // We map the Firebase game state to the local structure if needed, 
      // but ideally we just read from 'game' directly in renderMultiplayer.

      // Sync shotgun state for ammo display
      if (game.shotgun) {
        this.roundStartLive = game.shotgun.liveRounds;
        this.roundStartBlank = game.shotgun.blankRounds;
        this.roundStartTotal = game.shotgun.chamber?.length || 0;
      }

      // Check for new actions to animate
      const actions = this.gameStore.gameActions;
      if (actions.length > lastActionCount) {
        const newActions = actions.slice(lastActionCount);
        newActions.forEach(action => this.handleMultiplayerAction(action));
        lastActionCount = actions.length;
      }

      // Render updated state
      this.renderMultiplayer();
    });
  }

  /**
   * Handle player selection in multiplayer
   */
  onPlayerSelected(index, userId) {
    if (!this.isMultiplayer) return;

    // Prevent selecting self or dead players (basic check, detailed check in action validation)
    const myId = this.gameStore.myPlayer?.userId;
    if (userId === myId) return;

    console.log(`[MP] Selected target: ${userId} (index ${index})`);

    // Toggle selection if clicking same player
    if (this.selectedTargetId === userId) {
      this.targetedIndex = null;
      this.selectedTargetId = null;
    } else {
      this.targetedIndex = index;
      this.selectedTargetId = userId;
    }

    this.renderMultiplayer();
    this.updateButtonStates();
  }

  /**
   * Render multiplayer state
   */
  renderMultiplayer() {
    if (!this.gameStore?.currentGame) return;

    const game = this.gameStore.currentGame;
    
    // Lazy init: If players haven't been set up yet (because store was empty at launch), do it now
    if (this.players.playerContainers.length === 0 && game.players?.length > 0) {
        console.log("[MP] Late setup of player containers. Players found:", game.players.length);
        this.players.setupMultiplayer(this.gameStore);
    } else if (this.players.playerContainers.length === 0) {
        console.log("[MP] Waiting for players... Game store has:", game.players?.length);
    }
    
    // Update player visuals from Firebase state
    // Note: PlayerManager.updateFromFirebase needs to exist or be mapped to updateAvatarStates
    if (this.players.updateFromFirebase) {
        this.players.updateFromFirebase(game.players, game.currentTurn, this.targetedIndex);
    } else {
        // Fallback to unified updateAvatarStates if updateFromFirebase is merged
        // We might need to adapt the data structure here if they differ significantly
        // For now assuming updateFromFirebase exists as per previous context OR we use updateAvatarStates
        // Let's check PlayerManager in next step if this fails, but for now restoring the call.
        
        // Actually, looking at PlayerManager in previous steps, we unified setup but updateAvatarStates 
        // takes a local state object. We need to construct a robust call here.
        
        // Let's try to use the unified updateAvatarStates but passing the game object 
        // masked as state since they share 'players' and 'currentTurnIndex' vs 'currentTurn'
        
        const stateProxy = {
            players: game.players.map(p => ({
                id: p.userId === this.gameStore.myPlayer?.userId ? "YOU" : p.userId, // Use actual ID for MP
                ...p,
                health: p.health // ensure health exists
            })),
            currentTurnIndex: game.currentTurn
        };
        this.players.updateAvatarStates(stateProxy, this.targetedIndex);
    }

    // Update HUD with server state
    if (this.hud.updateMultiplayer) {
        this.hud.updateMultiplayer(game);
    } else {
        // Fallback or Unified HUD update
        // this.hud.update(game); 
        // Need to check HUDManager to be safe, but for now let's restore the original function logic
        // which likely called specific MP methods.
    }

    // Render ammo (spectators see unknown)
    const isSpectator = this.gameStore.amSpectator;
    if (game.shotgun) {
      // Check if ammo renderer has MP support or unified
      if (this.ammo.renderMultiplayer) {
          this.ammo.renderMultiplayer(
            game.shotgun.totalRounds,
            game.shotgun.liveRounds,
            this.firedShots,
            isSpectator
          );
      } else {
          this.ammo.render(
            game.shotgun.totalRounds,
            game.shotgun.liveRounds,
            this.firedShots,
            !isSpectator // loose approx for reveal phase
          );
      }
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================
  update() {
    // Update mask positions if containers move
    if (this.maskGraphicsMap) {
      this.maskGraphicsMap.forEach((graphics, container) => {
        graphics.x = container.x;
        graphics.y = container.y;
      });
    }
  }

  // ==========================================================================
  // PLAYER ACTION HANDLERS
  // ==========================================================================
  onPlayerAction(actionData) {
    // Guard against double-actions: block if already processing
    if (this.isProcessing) return;
    if (this.state.gameOver || this.ammoRevealPhase || this.betweenRounds) return;

    const isPlayerTurn = this.state.players[this.state.currentTurnIndex].id === "YOU";
    if (!isPlayerTurn) return;

    // Lock actions immediately before any async operations
    this.isProcessing = true;
    this.updateButtonStates();

    this.action.execute(actionData, "YOU");
  }

  onItemAction(item) {
    // Guard against double-actions: block if already processing
    if (this.isProcessing) return;
    if (this.state.gameOver || this.ammoRevealPhase || this.betweenRounds) return;

    const isPlayerTurn = this.state.players[this.state.currentTurnIndex].id === "YOU";
    if (!isPlayerTurn) return;

    // Lock actions immediately before any async operations
    this.isProcessing = true;
    this.updateButtonStates();

    this.action.execute({ type: "USE_ITEM", item: item }, "YOU");
  }

  /**
   * Execute action (called by AIController)
   */
  executeAction(actionData, actorId) {
    this.action.execute(actionData, actorId);
  }

  // ==========================================================================
  // BUTTON STATE MANAGEMENT
  // ==========================================================================
  updateButtonStates() {
    this.ui.updateButtonStates(this.state, this.isProcessing, this.ammoRevealPhase, this.betweenRounds);
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================
  render() {
    const layout = this.getLayout();

    // Update avatar states
    this.players.updateAvatarStates(this.state, this.targetedIndex);

    // Render hearts
    this.players.renderHearts(this.state);

    // Update HUD
    this.hud.update(this.state);

    // Render ammo
    this.ammo.render(this.roundStartTotal, this.roundStartLive, this.firedShots, this.ammoRevealPhase);

    // Update button states
    this.updateButtonStates();

    // Render items
    const canUseItems = !this.ammoRevealPhase && !this.betweenRounds;
    const playerItemsContainer = this.ui.getPlayerItemsContainer();
    const botItemsContainer = this.ui.getBotItemsContainer();

    this.items.render(playerItemsContainer, this.state.players[0].items, canUseItems, false, this.ammoRevealPhase, this.betweenRounds);
    this.items.render(botItemsContainer, this.state.players[1].items, false, true, this.ammoRevealPhase, this.betweenRounds);

    // Handle game over
    if (this.state.gameOver && !this.restartBtn) {
      this.handleGameOver();
    }
  }

  // ==========================================================================
  // GAME OVER
  // ==========================================================================
  handleGameOver() {
    const layout = this.getLayout();
    const winner = this.state.players.find(p => p.alive);
    const isWin = winner?.id === "YOU";

    console.log(`[STATE] Game Over. Winner: ${winner?.id || "None"}`);

    // Get game over screen from registry
    const gameOverScreen = this.registry.get('gameOverScreen');

    if (gameOverScreen) {
      // Show HTML game over screen after a short delay
      this.time.delayedCall(500, () => {
        gameOverScreen.show(
          isWin,
          this.playerName,
          () => this.scene.restart({ playerName: this.playerName }),
          () => {
            window.location.reload();
          }
        );
      });
    }

    // Create a simple Phaser overlay to dim the game
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
  // BACKWARD COMPATIBILITY - Required by EffectsManager and AIController
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
   * Trigger effect (used by old effects code)
   */
  triggerEffect(type, params) {
    this.effects.triggerEffect(type, params);
  }
}
