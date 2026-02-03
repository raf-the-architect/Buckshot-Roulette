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
  }

  init(data) {
    this.playerName = data.playerName || "YOU";
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
    this.load.setPath("assets/");

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
  create() {
    const layout = this.getLayout();

    // Initialize game state
    this.rng = { random: () => Math.random() };
    this.state = createInitialState();
    refillShotgun(this.state, this.rng);
    giveItems(this.state, this.rng);

    // Reset flags
    this.restartBtn = null;
    this.isProcessing = false;
    this.ammoRevealPhase = true;
    this.firedShots = [];
    this.roundStartLive = this.state.shotgun.live;
    this.roundStartBlank = this.state.shotgun.blank;
    this.roundStartTotal = this.state.shotgun.chamber.length;
    this.nextAmmoRevealed = null;
    this.betweenRounds = false;
    this.targetedIndex = null;

    // Initialize managers
    this.effects = new EffectsManager(this);
    this.ai = new AIController(this);
    this.hud = new HUDManager(this);
    this.players = new PlayerManager(this);
    this.gun = new GunManager(this);
    this.ammo = new AmmoRenderer(this);
    this.ui = new UIManager(this);
    this.action = new ActionHandler(this);
    this.round = new RoundManager(this);
    this.items = new ItemRenderer(this);

    // Background
    this.add.image(layout.CENTER_X, layout.HEIGHT / 2, "bg")
      .setDisplaySize(layout.WIDTH, layout.HEIGHT);

    // Subtle vignette overlay
    this.add.rectangle(layout.CENTER_X, layout.HEIGHT / 2, layout.WIDTH, layout.HEIGHT, 0x000000, 0.25);

    // Setup all managers
    this.hud.setup();
    this.players.setup(this.playerName);
    this.gun.setup();
    this.ammo.setup();
    this.ui.setup();

    // Initial render
    this.render();

    // Background music (loop + low volume)
    this.sound.play("sndMusic", { loop: true, volume: 0.08 });

    // Start first round
    console.log("[STATE] Game Started");
    this.round.startAmmoReveal();
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
