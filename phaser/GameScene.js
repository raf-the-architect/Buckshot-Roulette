import { applyAction, createInitialState, refillShotgun, giveItems, ITEM_KEYS } from "./gameLogic.js";
import { decideAIAction } from "./ai.js";

// ============================================================================
// ASSET KEYS
// ============================================================================
const ASSETS = {
  BG: "background.png",
  AVATAR: "avatar.png",
  AVATAR_ACTIVE: "avatar-active.png",
  AVATAR_DEAD: "avatar-dead.png",
  GUN: "gun.png",
  BTN_SHOOT_PLAYER: "shoot-player_btn.png",
  BTN_SHOOT_SELF: "shoot-self_btn.png",
  AMMO_FILLED: "ammo_filled.png",
  AMMO_EMPTY: "ammo_empty.png",
  AMMO_UNKNOWN: "ammo_unknown.png",
  HEART_FULL: "live-filled_icon.png",
  HEART_EMPTY: "live-empty_icon.png",
  ITEM_KNIFE: "knife_item.png",
  ITEM_MAGNIFY: "magnifyin-glass_item.png",
  ITEM_HANDCUFFS: "handcuffs_item.png",
  ITEM_BEER: "beer_item.png",
  ITEM_CIGARETTE: "sigarette_item.png"
};

const SOUNDS = {
  REVOLVER_SPIN: "sounds/revolver-spin.mp3",
  RELOAD: "sounds/clean-revolver-reload.mp3",
  GUNSHOT: "sounds/single-pistol-gunshot.mp3",
  DRY_FIRE: "sounds/double-dry-fire.mp3",
  BG_MUSIC: "sounds/bg-music.mp3"
};

const ITEM_ASSET_MAP = {
  [ITEM_KEYS.KNIFE]: "itemKnife",
  [ITEM_KEYS.MAGNIFYING_GLASS]: "itemMagnify",
  [ITEM_KEYS.HANDCUFFS]: "itemHandcuffs",
  [ITEM_KEYS.BEER]: "itemBeer",
  [ITEM_KEYS.CIGARETTE]: "itemCigarette"
};

// ============================================================================
// LAYOUT
// ============================================================================
const LAYOUT = {
  WIDTH: 360,
  HEIGHT: 640,
  CENTER_X: 180,
  TOP_ZONE: { y: 60 },
  BOT_ITEMS_ZONE: { y: 125 },
  GUN_ZONE: { y: 200 },
  AMMO_ZONE: { y: 280 },
  NEXT_AMMO_ZONE: { y: 235 },
  BTN_ZONE: { y: 370 },
  PLAYER_ITEMS_ZONE: { y: 460 },
  BOTTOM_ZONE: { y: 560 }
};

const SCALE = {
  AVATAR: 0.22,
  GUN: 0.4,
  BUTTON: 0.5,
  AMMO: 0.25,
  HEART: 0.28,
  ITEM: 0.18
};

const TINT_DISABLED = 0x555555;

export class GameScene extends Phaser.Scene {
  constructor() { 
    super("Game"); 
  }

  init(data) {
    this.playerName = data.playerName || "YOU";
  }

  // ==========================================================================
  // PRELOAD
  // ==========================================================================
  preload() {
    const base = "assets/";
    this.load.image("bg", base + ASSETS.BG);
    this.load.image("avatar", base + ASSETS.AVATAR);
    this.load.image("avatarActive", base + ASSETS.AVATAR_ACTIVE);
    this.load.image("avatarDead", base + ASSETS.AVATAR_DEAD);
    this.load.image("gun", base + ASSETS.GUN);
    this.load.image("btnShootPlayer", base + ASSETS.BTN_SHOOT_PLAYER);
    this.load.image("btnShootSelf", base + ASSETS.BTN_SHOOT_SELF);
    this.load.image("ammoFilled", base + ASSETS.AMMO_FILLED);
    this.load.image("ammoEmpty", base + ASSETS.AMMO_EMPTY);
    this.load.image("ammoUnknown", base + ASSETS.AMMO_UNKNOWN);
    this.load.image("heartFull", base + ASSETS.HEART_FULL);
    this.load.image("heartEmpty", base + ASSETS.HEART_EMPTY);
    this.load.image("itemKnife", base + ASSETS.ITEM_KNIFE);
    this.load.image("itemMagnify", base + ASSETS.ITEM_MAGNIFY);
    this.load.image("itemHandcuffs", base + ASSETS.ITEM_HANDCUFFS);
    this.load.image("itemBeer", base + ASSETS.ITEM_BEER);
    this.load.image("itemCigarette", base + ASSETS.ITEM_CIGARETTE);
    
    // Load sounds
    this.load.audio("sndSpin", base + SOUNDS.REVOLVER_SPIN);
    this.load.audio("sndReload", base + SOUNDS.RELOAD);
    this.load.audio("sndGunshot", base + SOUNDS.GUNSHOT);
    this.load.audio("sndDryFire", base + SOUNDS.DRY_FIRE);
    this.load.audio("sndMusic", base + SOUNDS.BG_MUSIC);
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================
  create() {
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
    this.betweenRounds = false;  // true during 3s timeout between rounds

    // Background
    this.add.image(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, "bg")
      .setDisplaySize(LAYOUT.WIDTH, LAYOUT.HEIGHT);

    this.setupPlayers();
    this.setupGun();
    this.setupUI();
    this.render();

    // Background music (loop + low volume)
    this.sound.play("sndMusic", { loop: true, volume: 0.1 });

    // Start first round
    console.log("[STATE] Game Started");
    this.startAmmoReveal();
  }

  // ==========================================================================
  // SETUP SYSTEMS
  // ==========================================================================

  setupPlayers() {
    this.playerContainers = [];
    
    const positions = [
      { x: LAYOUT.CENTER_X, y: LAYOUT.BOTTOM_ZONE.y, id: "YOU", name: this.playerName },
      { x: LAYOUT.CENTER_X, y: LAYOUT.TOP_ZONE.y, id: "BOT", name: "DEALER" }
    ];

    positions.forEach((pos, i) => {
      const container = this.add.container(pos.x, pos.y);
      
      const avatar = this.add.image(0, 0, "avatar")
        .setScale(SCALE.AVATAR)
        .setOrigin(0.5, 0.5);
      
      const nameText = this.add.text(0, 45, pos.name, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
      }).setOrigin(0.5);

      const heartContainer = this.add.container(0, 70);
      
      container.add([avatar, nameText, heartContainer]);
      this.playerContainers[i] = { container, heartContainer, avatar, id: pos.id, nameText };

      // Idle animation (subtle bobbing)
      this.tweens.add({
        targets: container,
        y: pos.y + (i === 0 ? 5 : -5), // Player bobs down, Bot bobs up
        duration: 2000 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
  }
  setupGun() {
    this.gunSprite = this.add.image(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y, "gun")
      .setScale(SCALE.GUN)
      .setOrigin(0.5, 0.5);
    
    // Next ammo reveal sprite (for magnifying glass)
    this.nextAmmoSprite = this.add.image(LAYOUT.CENTER_X, LAYOUT.NEXT_AMMO_ZONE.y, "ammoUnknown")
      .setScale(SCALE.AMMO * 1.3)
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    
    // Crossed revolvers container (for knife double damage - 2 cloned guns)
    this.crossedRevolversContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y);
    
    // Left gun - rotated and positioned
    this.gunLeft = this.add.image(-25, 0, "gun")
      .setScale(SCALE.GUN * 0.85)
      .setOrigin(0.5, 0.5)
      .setAngle(-35)
      .setFlipX(true);  // Mirror horizontally
    
    // Right gun - rotated opposite direction
    this.gunRight = this.add.image(25, 0, "gun")
      .setScale(SCALE.GUN * 0.85)
      .setOrigin(0.5, 0.5)
      .setAngle(35);
    
    this.crossedRevolversContainer.add([this.gunLeft, this.gunRight]);
    this.crossedRevolversContainer.setVisible(false);
  }

  setupUI() {
    // Ammo container
    this.ammoContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.AMMO_ZONE.y);

    // Buttons
    const btnSpacing = 90;
    
    this.btnShootBot = this.add.image(LAYOUT.CENTER_X - btnSpacing, LAYOUT.BTN_ZONE.y, "btnShootPlayer")
      .setScale(SCALE.BUTTON)
      .setOrigin(0.5, 0.5);
    this.setupButtonFeedback(this.btnShootBot, () => this.onPlayerAction({ type: "SHOOT_PLAYER", playerId: "YOU", targetId: "BOT" }));
    
    this.btnShootSelf = this.add.image(LAYOUT.CENTER_X + btnSpacing, LAYOUT.BTN_ZONE.y, "btnShootSelf")
      .setScale(SCALE.BUTTON)
      .setOrigin(0.5, 0.5);
    this.setupButtonFeedback(this.btnShootSelf, () => this.onPlayerAction({ type: "SHOOT_SELF", playerId: "YOU" }));

    // Item containers
    this.playerItemsContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.PLAYER_ITEMS_ZONE.y);
    this.botItemsContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.BOT_ITEMS_ZONE.y);
    
    // Action indicator
    this.actionIndicator = this.add.container(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2);

    // HUD - Round & Turn
    this.hudRound = this.add.text(10, 10, "ROUND: 1", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffff00",
      stroke: "#000000",
      strokeThickness: 3
    });

    this.hudTurn = this.add.text(LAYOUT.WIDTH - 10, 10, "TURN: YOU", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(1, 0);
  }

  // ==========================================================================
  // GAME SYSTEMS: STATE & TURN
  // ==========================================================================

  startAmmoReveal() {
    this.ammoRevealPhase = true;
    this.firedShots = [];
    this.roundStartLive = this.state.shotgun.live;
    this.roundStartBlank = this.state.shotgun.blank;
    this.roundStartTotal = this.state.shotgun.chamber.length;
    this.nextAmmoRevealed = null;
    this.nextAmmoSprite.setVisible(false);
    this.gunSprite.setAngle(0);
    this.crossedRevolversContainer.setAngle(0);
    
    console.log(`[STATE] New Round Started. Chamber: ${this.roundStartLive} Live, ${this.roundStartBlank} Blank`);
    
    // Play spin sound
    this.sound.play("sndSpin");
    
    this.render();
    
    // Disable all actions for 3 seconds
    this.time.delayedCall(3000, () => {
      // Soft exit for reveal phase
      this.tweens.add({
        targets: this.ammoContainer,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.ammoRevealPhase = false;
          this.render();
          this.ammoContainer.setAlpha(1); // Reset for normal play
          this.checkAITurn();
        }
      });
    });
  }

  // Start new round with 3s timeout
  startRoundTimeout() {
    this.betweenRounds = true;
    this.render();
    
    // Play reload sound
    this.sound.play("sndReload");
    
    // Show reload message
    const reloadText = this.add.text(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, "🔄 RELOADING...", {
      fontSize: "24px",
      fontFamily: "Arial",
      color: "#ffff00",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5, 0.5);
    
    this.tweens.add({
      targets: reloadText,
      alpha: { from: 1, to: 0.5 },
      scale: { from: 1, to: 1.1 },
      duration: 500,
      yoyo: true,
      repeat: 2
    });
    
    this.time.delayedCall(3000, () => {
      reloadText.destroy();
      this.betweenRounds = false;
      this.startAmmoReveal();
    });
  }

  renderAmmo() {
    this.ammoContainer.removeAll(true);
    
    const totalSlots = this.roundStartTotal;
    const fired = this.firedShots.length;
    
    const ammoSpacing = 28;
    const startX = -((totalSlots - 1) * ammoSpacing) / 2;
    
    for (let i = 0; i < totalSlots; i++) {
      let ammoKey;
      
      if (i < fired) {
        ammoKey = this.firedShots[i].wasLive ? "ammoFilled" : "ammoEmpty";
      } else if (this.ammoRevealPhase) {
        const liveCount = this.roundStartLive;
        const firedLive = this.firedShots.filter(s => s.wasLive).length;
        const remainingLive = liveCount - firedLive;
        const remainingSlotIndex = i - fired;
        
        if (remainingSlotIndex < remainingLive) {
          ammoKey = "ammoFilled";
        } else {
          ammoKey = "ammoEmpty";
        }
      } else {
        ammoKey = "ammoUnknown";
      }
      
      const ammo = this.add.image(startX + i * ammoSpacing, 0, ammoKey)
        .setScale(SCALE.AMMO)
        .setOrigin(0.5, 0.5);
      
      if (this.ammoRevealPhase && i >= fired) {
        ammo.setAlpha(0);
        this.tweens.add({
          targets: ammo,
          alpha: 1,
          scale: SCALE.AMMO * 1.2,
          duration: 300,
          delay: (i - fired) * 150,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: ammo,
              scale: SCALE.AMMO,
              duration: 100
            });
            // Flash on "lock-in" of the last ammo revealed
            if (i === totalSlots - 1) {
               this.triggerEffect("flash", { color: 0xffffff, alpha: 0.2, duration: 200 });
            }
          }
        });
      }
      
      this.ammoContainer.add(ammo);
    }
  }

  // ==========================================================================
  // EFFECT PRIORITY SYSTEM
  // ==========================================================================
  triggerEffect(type, params) {
    if (type === "shake") {
      // Prevent screen shake overload
      if (this.isShaking) return;
      this.isShaking = true;
      this.cameras.main.shake(params.duration || 150, params.intensity || 0.008);
      this.time.delayedCall(params.duration || 150, () => this.isShaking = false);
    } else if (type === "flash") {
      const flash = this.add.rectangle(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, LAYOUT.WIDTH, LAYOUT.HEIGHT, params.color || 0xffffff, params.alpha || 0.5)
        .setDepth(1000);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: params.duration || 300,
        onComplete: () => flash.destroy()
      });
    }
  }

  // ==========================================================================
  // ACTION INDICATOR
  // ==========================================================================
  showActionIndicator(actorId, actionType, itemKey = null) {
    this.actionIndicator.removeAll(true);
    
    const isBot = actorId === "BOT";
    const y = isBot ? -180 : 180;
    
    let iconKey = null;
    let color = 0xffffff;
    
    if (actionType === "USE_ITEM" && itemKey) {
      iconKey = ITEM_ASSET_MAP[itemKey];
      color = this.getItemColor(itemKey);
    } else if (actionType === "SHOOT_PLAYER") {
      color = 0xff4444;
    } else if (actionType === "SHOOT_SELF") {
      color = 0x44aaff;
    }
    
    const bg = this.add.circle(0, y, 35, color, 0.3);
    this.actionIndicator.add(bg);
    
    if (iconKey) {
      const icon = this.add.image(0, y, iconKey)
        .setScale(SCALE.ITEM * 2)
        .setOrigin(0.5, 0.5);
      this.actionIndicator.add(icon);
      
      this.tweens.add({
        targets: [bg, icon],
        scale: { from: 0.5, to: 1.2 },
        duration: 200,
        ease: 'Back.easeOut',
        yoyo: true,
        hold: 400,
        onComplete: () => {
          this.tweens.add({
            targets: [bg, icon],
            alpha: 0,
            duration: 200,
            onComplete: () => this.actionIndicator.removeAll(true)
          });
        }
      });
    } else {
      this.tweens.add({
        targets: bg,
        scale: { from: 0.3, to: 1.5 },
        alpha: { from: 0.6, to: 0 },
        duration: 400,
        onComplete: () => this.actionIndicator.removeAll(true)
      });
    }
  }

  getItemColor(itemKey) {
    const colors = {
      [ITEM_KEYS.KNIFE]: 0xff6666,
      [ITEM_KEYS.MAGNIFYING_GLASS]: 0x66ddff,
      [ITEM_KEYS.HANDCUFFS]: 0xaaaaaa,
      [ITEM_KEYS.BEER]: 0xffcc44,
      [ITEM_KEYS.CIGARETTE]: 0x88ff88
    };
    return colors[itemKey] || 0xffffff;
  }

  // ==========================================================================
  // PLAYER ACTION HANDLER
  // ==========================================================================
  onPlayerAction(action) {
    if (this.state.gameOver || this.ammoRevealPhase || this.betweenRounds) return;
    
    const isPlayerTurn = this.state.players[this.state.currentTurnIndex].id === "YOU";
    if (!isPlayerTurn) return;
    
    this.executeAction(action, "YOU");
  }

  onItemAction(item) {
    if (this.state.gameOver || this.ammoRevealPhase || this.betweenRounds) return;
    
    const isPlayerTurn = this.state.players[this.state.currentTurnIndex].id === "YOU";
    if (!isPlayerTurn) return;
    
    this.executeAction({ type: "USE_ITEM", item: item }, "YOU");
  }

  executeAction(action, actorId) {
    const chamber = this.state.shotgun.chamber;
    const prevChamberLength = chamber.length;
    const prevHealth = this.state.players.map(p => p.health);
    
    // Determine wasLive BEFORE applying action
    // This is because applyAction might refill the chamber, resetting live/blank counts
    let wasLive = false;
    const isShot = action.type.startsWith("SHOOT");
    const isBeer = action.type === "USE_ITEM" && action.item === ITEM_KEYS.BEER;
    
    if ((isShot || isBeer) && prevChamberLength > 0) {
      wasLive = !!chamber[chamber.length - 1];
    }

    this.showActionIndicator(actorId, action.type, action.item);
    
    // Gun rotation logic
    let targetAngle = 0; // Default center
    if (action.type === "SHOOT_PLAYER") {
      targetAngle = (actorId === "YOU") ? -90 : 90; // YOU shoots BOT (Up), or BOT shoots YOU (Down)
    } else if (action.type === "SHOOT_SELF") {
      targetAngle = (actorId === "YOU") ? 90 : -90; // YOU shoots YOU (Down), or BOT shoots BOT (Up)
    }

    if (isShot) {
      this.isProcessing = true;
      this.tweens.add({
        targets: [this.gunSprite, this.crossedRevolversContainer],
        angle: targetAngle,
        duration: 300,
        ease: 'Cubic.easeOut'
      });
      // Wait for rotation before proceeding
      this.time.delayedCall(400, () => {
        this.processAction(action, actorId, wasLive, prevChamberLength);
      });
    } else {
      this.processAction(action, actorId, wasLive, prevChamberLength);
    }
  }

  processAction(action, actorId, wasLive, prevChamberLength) {
    const isShot = action.type.startsWith("SHOOT");
    const isBeer = action.type === "USE_ITEM" && action.item === ITEM_KEYS.BEER;
    const prevHealth = this.state.players.map(p => p.health);

    if (action.type === "USE_ITEM") {
      console.log(`[ACTION] ${actorId} used ${action.item}`);
    } else {
      const targetStr = action.type === "SHOOT_PLAYER" ? (actorId === "YOU" ? "BOT" : "YOU") : actorId;
      console.log(`[ACTION] ${actorId} shot ${targetStr}`);
    }

    this.state = applyAction(this.state, action, this.rng);
    
    if (isShot) {
      this.firedShots.push({ wasLive });
      
      console.log(`[RESULT] ${wasLive ? "💥 LIVE ROUND!" : "💨 BLANK ROUND"}`);
      
      // Clear magnifying glass reveal
      this.nextAmmoRevealed = null;
      this.nextAmmoSprite.setVisible(false);
      
      // Play sound and visual effect
      if (wasLive) {
        this.sound.play("sndGunshot");
      } else {
        this.sound.play("sndDryFire");
      }
      this.playShootEffect(wasLive, action);
      
      // Clear knife double damage visual after shot
      this.crossedRevolversContainer.setVisible(false);
      this.gunSprite.setVisible(true);
      this.gunSprite.clearTint();
      
      this.state.players.forEach((p, i) => {
        if (p.health < prevHealth[i]) {
          this.playDamageEffect(i);
        }
      });
    }
    
    if (action.type === "USE_ITEM") {
      this.playItemEffect(action.item, actorId);
      
      if (isBeer && prevChamberLength > 0) {
        this.firedShots.push({ wasLive });
        this.playBeerEffect(wasLive);
      }
      
      if (action.item === ITEM_KEYS.MAGNIFYING_GLASS) {
        this.revealNextAmmo();
      }
      
      if (action.item === ITEM_KEYS.CIGARETTE) {
        const idx = actorId === "YOU" ? 0 : 1;
        this.playHealEffect(idx);
      }
      
      if (action.item === ITEM_KEYS.HANDCUFFS) {
        const targetIdx = actorId === "YOU" ? 1 : 0;
        this.playHandcuffEffect(targetIdx);
      }
      
      if (action.item === ITEM_KEYS.KNIFE) {
        this.playKnifeEffect();
      }
    }
    
    // Check if new round started (chamber refilled)
    if (this.state.shotgun.chamber.length > prevChamberLength) {
      this.time.delayedCall(500, () => {
        this.startRoundTimeout();
      });
    }
    
    this.render();

    if (action.type.startsWith("SHOOT")) {
      this.isProcessing = true;
      this.time.delayedCall(800, () => {
        this.isProcessing = false;
        this.tweens.add({
          targets: [this.gunSprite, this.crossedRevolversContainer],
          angle: 0,
          duration: 300,
          ease: 'Cubic.easeOut'
        });
        this.checkAITurn();
      });
    } else {
      this.time.delayedCall(100, () => {
        this.checkAITurn();
      });
    }
  }

  // ==========================================================================
  // MAGNIFYING GLASS
  // ==========================================================================
  revealNextAmmo() {
    const chamber = this.state.shotgun.chamber;
    if (chamber.length === 0) return;
    
    const nextRound = chamber[chamber.length - 1];
    this.nextAmmoRevealed = nextRound;
    
    const ammoKey = nextRound ? "ammoFilled" : "ammoEmpty";
    this.nextAmmoSprite.setTexture(ammoKey);
    this.nextAmmoSprite.setVisible(true);
    this.nextAmmoSprite.setAlpha(0);
    this.nextAmmoSprite.setScale(0.1);
    
    this.tweens.add({
      targets: this.nextAmmoSprite,
      alpha: 1,
      scale: SCALE.AMMO * 1.5,
      duration: 300,
      ease: 'Back.easeOut'
    });
    
    const glow = this.add.circle(LAYOUT.CENTER_X, LAYOUT.NEXT_AMMO_ZONE.y, 25, nextRound ? 0xff4444 : 0x4488ff, 0.4);
    this.tweens.add({
      targets: glow,
      scale: { from: 0.5, to: 2 },
      alpha: 0,
      duration: 500,
      onComplete: () => glow.destroy()
    });
  }

  // ==========================================================================
  // GAME SYSTEMS: VISUAL EFFECTS
  // ==========================================================================

  triggerEffect(type, params) {
    if (type === "shake") {
      if (this.isShaking) return;
      this.isShaking = true;
      this.cameras.main.shake(params.duration || 150, params.intensity || 0.008);
      this.time.delayedCall(params.duration || 150, () => this.isShaking = false);
    } else if (type === "flash") {
      const flash = this.add.rectangle(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, LAYOUT.WIDTH, LAYOUT.HEIGHT, params.color || 0xffffff, params.alpha || 0.5)
        .setDepth(1000);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: params.duration || 300,
        onComplete: () => flash.destroy()
      });
    }
  }

  playShootEffect(wasLive, action) {
    if (wasLive) {
      const flash = this.add.circle(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y, 40, 0xffff00, 1);
      this.tweens.add({
        targets: flash,
        scale: { from: 0.3, to: 1.5 },
        alpha: { from: 1, to: 0 },
        duration: 200,
        onComplete: () => flash.destroy()
      });
      
      this.triggerEffect("shake", { duration: 150, intensity: 0.008 });
      
      this.tweens.add({
        targets: this.gunSprite,
        angle: { from: -10, to: 0 },
        duration: 200,
        ease: 'Back.easeOut'
      });
      
      this.triggerEffect("flash", { color: 0xff0000, alpha: 0.25, duration: 300 });
    } else {
      const puff = this.add.circle(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y - 15, 15, 0x4488ff, 0.6);
      this.tweens.add({
        targets: puff,
        scale: { from: 0.5, to: 2 },
        alpha: 0,
        y: LAYOUT.GUN_ZONE.y - 40,
        duration: 350,
        onComplete: () => puff.destroy()
      });
      
      this.tweens.add({
        targets: this.gunSprite,
        angle: { from: -3, to: 3 },
        duration: 80,
        yoyo: true,
        repeat: 2
      });
    }
  }

  playDamageEffect(playerIndex) {
    const pc = this.playerContainers[playerIndex];
    
    pc.avatar.setTint(0xff0000);
    this.time.delayedCall(150, () => {
      pc.avatar.clearTint();
    });
    
    const hearts = pc.heartContainer.list;
    if (hearts.length > 0) {
      // Find the heart that was most recently "emptied" (visual sync with state)
      const lastFullHeartIdx = hearts.findLastIndex(h => h.texture.key === "heartFull");
      const targetHeart = lastFullHeartIdx !== -1 ? hearts[lastFullHeartIdx] : null;
      
      if (targetHeart) {
        this.tweens.add({
          targets: targetHeart,
          y: targetHeart.y - 15,
          scale: SCALE.HEART * 1.5,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
          onComplete: () => {
            targetHeart.setTexture("heartEmpty");
            targetHeart.y = 0;
            targetHeart.alpha = 0.5;
            targetHeart.setScale(SCALE.HEART);
          }
        });
      }
    }
  }

  playItemEffect(itemKey, actorId) {
    const isBot = actorId === "BOT";
    const baseY = isBot ? LAYOUT.BOT_ITEMS_ZONE.y : LAYOUT.PLAYER_ITEMS_ZONE.y;
    
    const color = this.getItemColor(itemKey);
    for (let i = 0; i < 6; i++) {
      const sparkle = this.add.circle(
        LAYOUT.CENTER_X + Phaser.Math.Between(-40, 40),
        baseY + Phaser.Math.Between(-20, 20),
        5,
        color,
        1
      );
      this.tweens.add({
        targets: sparkle,
        scale: { from: 1, to: 0 },
        y: sparkle.y - 30,
        alpha: 0,
        duration: 400,
        delay: i * 50,
        onComplete: () => sparkle.destroy()
      });
    }
  }

  playBeerEffect(wasLive) {
    const color = wasLive ? 0xff4444 : 0x4488ff;
    const eject = this.add.circle(LAYOUT.CENTER_X + 30, LAYOUT.GUN_ZONE.y, 8, color, 1);
    this.tweens.add({
      targets: eject,
      x: LAYOUT.CENTER_X + 100,
      y: LAYOUT.GUN_ZONE.y + 50,
      rotation: 3,
      alpha: 0,
      duration: 500,
      onComplete: () => eject.destroy()
    });
  }

  playHealEffect(playerIndex) {
    const pc = this.playerContainers[playerIndex];
    
    pc.avatar.setTint(0x44ff44);
    this.time.delayedCall(300, () => {
      pc.avatar.clearTint();
    });
    
    for (let i = 0; i < 4; i++) {
      const plus = this.add.circle(
        pc.container.x + Phaser.Math.Between(-20, 20),
        pc.container.y - 20,
        6,
        0x44ff44,
        0.8
      );
      this.tweens.add({
        targets: plus,
        y: plus.y - 40,
        alpha: 0,
        duration: 600,
        delay: i * 100,
        onComplete: () => plus.destroy()
      });
    }
  }

  playHandcuffEffect(targetIndex) {
    const pc = this.playerContainers[targetIndex];
    
    const chain = this.add.image(pc.container.x, pc.container.y, "itemHandcuffs")
      .setScale(0.3)
      .setAlpha(0);
    
    this.tweens.add({
      targets: chain,
      alpha: 1,
      scale: 0.15,
      duration: 300,
      yoyo: true,
      hold: 300,
      onComplete: () => chain.destroy()
    });
    
    pc.avatar.setTint(0x888888);
    this.time.delayedCall(400, () => {
      pc.avatar.clearTint();
    });
  }

  playKnifeEffect() {
    // Show crossed revolvers (2 cloned guns) instead of just tinting
    this.crossedRevolversContainer.setVisible(true);
    this.crossedRevolversContainer.setAlpha(0);
    this.crossedRevolversContainer.setScale(0.3);
    
    // Hide normal gun
    this.gunSprite.setVisible(false);
    
    // Add red tint to both guns
    this.gunLeft.setTint(0xff6666);
    this.gunRight.setTint(0xff6666);
    
    // Animate crossed revolvers appearing
    this.tweens.add({
      targets: this.crossedRevolversContainer,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
    
    // Slash effect
    const slash = this.add.rectangle(LAYOUT.CENTER_X - 20, LAYOUT.GUN_ZONE.y, 60, 4, 0xff4444, 1)
      .setAngle(-45);
    this.tweens.add({
      targets: slash,
      x: LAYOUT.CENTER_X + 20,
      alpha: 0,
      duration: 200,
      onComplete: () => slash.destroy()
    });
  }

  // ==========================================================================
  // AI TURN
  // ==========================================================================
  checkAITurn() {
    if (this.state.gameOver || this.ammoRevealPhase || this.betweenRounds) return;
    
    const actor = this.state.players[this.state.currentTurnIndex];
    this.updateButtonStates();
    
    // Reset knife visuals if damage is back to 1
    if (this.state.shotgun.damage === 1) {
      this.crossedRevolversContainer.setVisible(false);
      this.gunSprite.setVisible(true);
      this.gunSprite.clearTint();
    }

    if (actor.id === "BOT") {
      this.isProcessing = true;
      this.updateButtonStates();
      
      // Show "thinking" indicator
      this.showThinkingIndicator(true);
      
      this.time.delayedCall(1200 + Math.random() * 800, () => {
        if (this.ammoRevealPhase || this.betweenRounds) {
          this.showThinkingIndicator(false);
          return;
        }
        
        const aiAction = decideAIAction(this.state, this.rng);
        this.showThinkingIndicator(false);
        
        if (aiAction) {
          this.executeAction(aiAction, "BOT");
        } else {
          this.isProcessing = false;
          this.updateButtonStates();
        }
      });
    }
  }

  showThinkingIndicator(show) {
    const pc = this.playerContainers[1]; // BOT
    if (show) {
      this.tweens.add({
        targets: pc.avatar,
        scale: SCALE.AVATAR * 1.1,
        alpha: 0.8,
        duration: 400,
        yoyo: true,
        repeat: -1
      });
    } else {
      this.tweens.killTweensOf(pc.avatar);
      pc.avatar.setScale(SCALE.AVATAR);
      pc.avatar.setAlpha(1);
    }
  }

  setupButtonFeedback(button, callback) {
    button.setInteractive({ useHandCursor: true });
    
    button.on("pointerdown", () => {
      this.tweens.add({
        targets: button,
        scale: SCALE.BUTTON * 0.9,
        duration: 80,
        ease: 'Cubic.easeOut'
      });
      callback();
    });
    
    button.on("pointerup", () => {
      this.tweens.add({
        targets: button,
        scale: SCALE.BUTTON * 1.1,
        duration: 120,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: button,
            scale: SCALE.BUTTON,
            duration: 150
          });
        }
      });
    });

    button.on("pointerout", () => {
      this.tweens.add({
        targets: button,
        scale: SCALE.BUTTON,
        duration: 150
      });
    });
  }

  // ==========================================================================
  // GAME SYSTEMS: RENDERING
  // ==========================================================================

  updateButtonStates() {
    const isPlayerTurn = this.state.players[this.state.currentTurnIndex].id === "YOU";
    const canAct = isPlayerTurn && !this.isProcessing && !this.state.gameOver && !this.ammoRevealPhase && !this.betweenRounds;
    
    if (canAct) {
      this.btnShootBot.setInteractive({ useHandCursor: true });
      this.btnShootSelf.setInteractive({ useHandCursor: true });
      this.btnShootBot.clearTint();
      this.btnShootSelf.clearTint();
    } else {
      this.btnShootBot.disableInteractive();
      this.btnShootSelf.disableInteractive();
      this.btnShootBot.setTint(TINT_DISABLED);
      this.btnShootSelf.setTint(TINT_DISABLED);
    }
  }
  render() {
    const players = this.state.players;
    const currentTurnIdx = this.state.currentTurnIndex;

    players.forEach((player, i) => {
      const pc = this.playerContainers[i];
      const isCurrentTurn = i === currentTurnIdx;
      
      let textureKey = "avatar";
      if (!player.alive) {
        textureKey = "avatarDead";
      } else if (isCurrentTurn) {
        textureKey = "avatarActive";
      }
      pc.avatar.setTexture(textureKey);
      pc.avatar.setAlpha(player.alive ? 1 : 0.4);
      
      // Apply desaturation/dimming for inactive players
      if (!isCurrentTurn && player.alive) {
        pc.avatar.setAlpha(0.6);
      }
      
      // Efficient heart rendering
      const maxHealth = 4;
      const heartSpacing = 20;
      const startX = -((maxHealth - 1) * heartSpacing) / 2;
      
      if (pc.heartContainer.list.length === 0) {
        for (let h = 0; h < maxHealth; h++) {
          const heart = this.add.image(startX + h * heartSpacing, 0, "heartEmpty")
            .setScale(SCALE.HEART)
            .setOrigin(0.5, 0.5);
          pc.heartContainer.add(heart);
        }
      }

      pc.heartContainer.list.forEach((heart, h) => {
        const isFull = h < player.health;
        const targetTexture = isFull ? "heartFull" : "heartEmpty";
        
        // Only change texture if needed to avoid flickering/resource waste
        if (heart.texture.key !== targetTexture) {
          heart.setTexture(targetTexture);
        }
        
        // Visual weight: Dim inactive player hearts
        heart.setAlpha(isCurrentTurn ? (isFull ? 1 : 0.4) : (isFull ? 0.5 : 0.2));
      });
    });

    // Update HUD
    if (this.hudRound) this.hudRound.setText(`ROUND: ${this.state.roundNumber}`);
    if (this.hudTurn) {
      const currentActor = players[currentTurnIdx];
      const turnName = currentActor.id === "YOU" ? this.playerName : "DEALER";
      this.hudTurn.setText(`TURN: ${turnName}`);
      this.hudTurn.setColor(currentActor.id === "YOU" ? "#00ff00" : "#ff4444");
    }

    this.renderAmmo();
    this.updateButtonStates();

    // Player items - only interactive if not in reveal/timeout phase
    const canUseItems = !this.ammoRevealPhase && !this.betweenRounds;
    this.playerItemsContainer.removeAll(true);
    this.renderItems(this.playerItemsContainer, players[0].items, canUseItems);
    
    this.botItemsContainer.removeAll(true);
    this.renderItems(this.botItemsContainer, players[1].items, false);

    if (this.state.gameOver && !this.restartBtn) {
      const winner = players.find(p => p.alive);
      const isWin = winner?.id === "YOU";
      const color = isWin ? 0x44ff44 : 0xff4444;
      
      console.log(`[STATE] Game Over. Winner: ${winner?.id || "None"}`);
      
      const overlay = this.add.rectangle(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, LAYOUT.WIDTH, LAYOUT.HEIGHT, 0x000000, 0.8)
        .setDepth(100);
      
      const title = this.add.text(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2 - 80, isWin ? "VICTORY" : "GAME OVER", {
        fontFamily: "Arial",
        fontSize: "48px",
        fontWeight: "bold",
        color: isWin ? "#44ff44" : "#ff0000",
        stroke: "#000000",
        strokeThickness: 6
      }).setOrigin(0.5).setDepth(101);

      const msg = this.add.text(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2 - 20, isWin ? `You defeated the Dealer!` : `The Dealer got you...`, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff"
      }).setOrigin(0.5).setDepth(101);
      
      this.restartBtn = this.add.container(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2 + 80).setDepth(101);
      
      const btnBg = this.add.rectangle(0, 0, 180, 50, color, 1)
        .setInteractive({ useHandCursor: true });
      
      const btnText = this.add.text(0, 0, "REPLAY", {
        fontFamily: "Arial",
        fontSize: "24px",
        fontWeight: "bold",
        color: "#ffffff"
      }).setOrigin(0.5);
      
      this.restartBtn.add([btnBg, btnText]);
      
      btnBg.on("pointerdown", () => {
        this.scene.start("StartScene");
      });
      
      this.tweens.add({
        targets: this.restartBtn,
        scale: { from: 0.95, to: 1.05 },
        duration: 400,
        yoyo: true,
        repeat: -1
      });
    }
  }

  // ==========================================================================
  // RENDER ITEMS
  // ==========================================================================
  renderItems(container, items, isInteractive) {
    const itemSpacing = 40;
    const startX = -((Math.min(items.length, 6) - 1) * itemSpacing) / 2;
    
    items.forEach((item, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const tx = startX + col * itemSpacing;
      const ty = row * 35;
      
      const assetKey = ITEM_ASSET_MAP[item];
      if (!assetKey) return;
      
      const icon = this.add.image(tx, ty, assetKey)
        .setScale(SCALE.ITEM)
        .setOrigin(0.5, 0.5);
      
      // Gray out items during reveal/timeout phases
      if (this.ammoRevealPhase || this.betweenRounds) {
        icon.setTint(TINT_DISABLED);
      }
      
      if (isInteractive && !this.ammoRevealPhase && !this.betweenRounds) {
        icon.setInteractive({ useHandCursor: true });
        icon.on("pointerover", () => icon.setScale(SCALE.ITEM * 1.25));
        icon.on("pointerout", () => icon.setScale(SCALE.ITEM));
        icon.on("pointerdown", () => this.onItemAction(item));
      }
      
      container.add(icon);
    });
  }
}
