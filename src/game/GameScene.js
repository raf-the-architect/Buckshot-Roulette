import { applyAction, createInitialState, refillShotgun, giveItems, ITEM_KEYS } from "./gameLogic.js";
import { ASSETS, SOUNDS, ITEM_ASSET_MAP, LAYOUT, SCALE, COLORS, FONTS } from "./LayoutConfig.js";
import { EffectsManager } from "./EffectsManager.js";
import { AIController } from "./AIController.js";


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

    // Initialize managers
    this.effects = new EffectsManager(this);
    this.ai = new AIController(this);

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

    // Background
    this.add.image(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, "bg")
      .setDisplaySize(LAYOUT.WIDTH, LAYOUT.HEIGHT);

    // Subtle vignette overlay
    this.add.rectangle(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, LAYOUT.WIDTH, LAYOUT.HEIGHT, 0x000000, 0.25);

    this.setupHUD();
    this.setupPlayers();
    this.setupGun();
    this.setupUI();
    this.render();

    // Background music (loop + low volume)
    this.sound.play("sndMusic", { loop: true, volume: 0.08 });

    // Start first round
    console.log("[STATE] Game Started");
    this.startAmmoReveal();
  }

  // ==========================================================================
  // HUD SETUP - Styled Panels
  // ==========================================================================
  setupHUD() {
    // Round indicator panel (top-left)
    const roundPanel = this.add.container(60, 18);
    const roundBg = this.add.rectangle(0, 0, 100, 28, COLORS.PANEL_BG, 0.8)
      .setStrokeStyle(1, COLORS.PANEL_BORDER);
    this.hudRound = this.add.text(0, 0, "Round 1", {
      ...FONTS.LABEL,
      fontSize: "13px"
    }).setOrigin(0.5);
    roundPanel.add([roundBg, this.hudRound]);

    // Turn indicator panel (top-right)
    const turnPanel = this.add.container(LAYOUT.WIDTH - 70, 18);
    const turnBg = this.add.rectangle(0, 0, 120, 28, COLORS.PANEL_BG, 0.8)
      .setStrokeStyle(1, COLORS.PANEL_BORDER);
    this.hudTurn = this.add.text(0, 0, "Your Turn", {
      ...FONTS.LABEL,
      fontSize: "13px"
    }).setOrigin(0.5);
    this.turnBg = turnBg;
    this.turnPanel = turnPanel;
    turnPanel.add([turnBg, this.hudTurn]);

    // Turn glow indicator
    this.turnGlow = this.add.rectangle(LAYOUT.WIDTH - 70, 18, 124, 32, 0x4a90d9, 0)
      .setStrokeStyle(2, 0x4a90d9);
  }

  // ==========================================================================
  // SETUP SYSTEMS
  // ==========================================================================

  setupPlayers() {
    this.playerContainers = [];

    const positions = [
      { x: LAYOUT.CENTER_X, y: LAYOUT.BOTTOM_ZONE.y, id: "YOU", name: this.playerName },
      { x: LAYOUT.CENTER_X, y: LAYOUT.TOP_ZONE.y, id: "BOT", name: "Dealer" }
    ];

    positions.forEach((pos, i) => {
      const container = this.add.container(pos.x, pos.y);

      // Active player glow ring (hidden initially)
      const glowRing = this.add.ellipse(0, 0, 85, 85, 0x4a90d9, 0);

      const avatar = this.add.image(0, 0, "avatar")
        .setScale(SCALE.AVATAR)
        .setOrigin(0.5, 0.5);

      const nameText = this.add.text(0, 48, pos.name, {
        ...FONTS.BODY,
        fontSize: "13px",
        color: COLORS.TEXT_PRIMARY
      }).setOrigin(0.5);

      const heartContainer = this.add.container(0, 72);

      container.add([glowRing, avatar, nameText, heartContainer]);
      this.playerContainers[i] = { container, heartContainer, avatar, glowRing, id: pos.id, nameText };

      // Subtle idle breathing (reduced intensity)
      this.tweens.add({
        targets: container,
        y: pos.y + (i === 0 ? 3 : -3),
        duration: 2500 + Math.random() * 500,
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

    // Crossed revolvers container (for knife double damage)
    this.crossedRevolversContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y);

    this.gunLeft = this.add.image(-25, 0, "gun")
      .setScale(SCALE.GUN * 0.85)
      .setOrigin(0.5, 0.5)
      .setAngle(-35)
      .setFlipX(true);

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

    // Buttons - Asymmetric layout
    const btnOffsetPrimary = 85;
    const btnOffsetSecondary = 95;

    // Shoot Dealer (Primary - Dominant)
    this.btnShootBot = this.add.image(LAYOUT.CENTER_X - btnOffsetPrimary, LAYOUT.BTN_ZONE.y - 5, "btnShootPlayer")
      .setScale(SCALE.BUTTON_PRIMARY)
      .setOrigin(0.5, 0.5);

    // Label for Shoot Dealer
    this.add.text(LAYOUT.CENTER_X - btnOffsetPrimary, LAYOUT.BTN_ZONE.y + 35, "Shoot Dealer", {
      ...FONTS.SMALL,
      fontSize: "10px",
      color: COLORS.TEXT_SECONDARY
    }).setOrigin(0.5);

    this.setupButtonFeedback(this.btnShootBot, SCALE.BUTTON_PRIMARY, () =>
      this.onPlayerAction({ type: "SHOOT_PLAYER", playerId: "YOU", targetId: "BOT" }));

    // Shoot Self (Secondary - Dangerous)
    this.btnShootSelf = this.add.image(LAYOUT.CENTER_X + btnOffsetSecondary, LAYOUT.BTN_ZONE.y + 5, "btnShootSelf")
      .setScale(SCALE.BUTTON_SECONDARY)
      .setOrigin(0.5, 0.5);

    // Label for Shoot Self
    this.add.text(LAYOUT.CENTER_X + btnOffsetSecondary, LAYOUT.BTN_ZONE.y + 40, "Shoot Self", {
      ...FONTS.SMALL,
      fontSize: "10px",
      color: COLORS.TEXT_MUTED
    }).setOrigin(0.5);

    this.setupButtonFeedback(this.btnShootSelf, SCALE.BUTTON_SECONDARY, () =>
      this.onPlayerAction({ type: "SHOOT_SELF", playerId: "YOU" }));

    // Item containers
    this.playerItemsContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.PLAYER_ITEMS_ZONE.y);
    this.botItemsContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.BOT_ITEMS_ZONE.y);

    // Action indicator
    this.actionIndicator = this.add.container(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2);
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

    // Show loading text during reveal
    this.revealLabel = this.add.text(LAYOUT.CENTER_X, LAYOUT.AMMO_ZONE.y - 35, "Loading chamber...", {
      ...FONTS.SMALL,
      color: COLORS.TEXT_MUTED
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.revealLabel,
      alpha: 0.8,
      duration: 300
    });

    this.render();

    // Disable all actions for 3 seconds
    this.time.delayedCall(3000, () => {
      // Fade out reveal label
      this.tweens.add({
        targets: this.revealLabel,
        alpha: 0,
        duration: 300,
        onComplete: () => this.revealLabel.destroy()
      });

      // Soft exit for reveal phase
      this.tweens.add({
        targets: this.ammoContainer,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          this.ammoRevealPhase = false;
          this.render();
          this.ammoContainer.setAlpha(1);
          this.ai.checkTurn();
        }
      });
    });
  }

  // Start new round with timeout
  startRoundTimeout() {
    this.betweenRounds = true;
    this.render();

    this.sound.play("sndReload");

    // Styled reload message
    const reloadContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2);
    const reloadBg = this.add.rectangle(0, 0, 160, 50, COLORS.PANEL_BG, 0.9)
      .setStrokeStyle(1, COLORS.PANEL_BORDER);
    const reloadText = this.add.text(0, 0, "Reloading...", {
      ...FONTS.LABEL,
      color: COLORS.WARNING
    }).setOrigin(0.5);
    reloadContainer.add([reloadBg, reloadText]);

    this.tweens.add({
      targets: reloadContainer,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.9, to: 1 },
      duration: 200,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: reloadText,
      alpha: { from: 1, to: 0.6 },
      duration: 400,
      yoyo: true,
      repeat: 3
    });

    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: reloadContainer,
        alpha: 0,
        scale: 0.9,
        duration: 200,
        onComplete: () => reloadContainer.destroy()
      });
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

      // Fired shells have reduced opacity
      if (i < fired) {
        ammo.setAlpha(0.4);
      }

      if (this.ammoRevealPhase && i >= fired) {
        ammo.setAlpha(0);
        this.tweens.add({
          targets: ammo,
          alpha: 1,
          scale: SCALE.AMMO * 1.15,
          duration: 250,
          delay: (i - fired) * 120,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: ammo,
              scale: SCALE.AMMO,
              duration: 100
            });
          }
        });
      }

      this.ammoContainer.add(ammo);
    }
  }


  // ==========================================================================
  // ACTION INDICATOR
  // ==========================================================================
  showActionIndicator(actorId, actionType, itemKey = null) {
    this.actionIndicator.removeAll(true);

    const isBot = actorId === "BOT";
    const y = isBot ? -170 : 170;

    let iconKey = null;
    let color = 0xffffff;

    if (actionType === "USE_ITEM" && itemKey) {
      iconKey = ITEM_ASSET_MAP[itemKey];
      color = this.effects.getItemColor(itemKey);
    } else if (actionType === "SHOOT_PLAYER") {
      color = 0xc62828;
    } else if (actionType === "SHOOT_SELF") {
      color = 0x4a90d9;
    }

    const bg = this.add.circle(0, y, 30, color, 0.25);
    this.actionIndicator.add(bg);

    if (iconKey) {
      const icon = this.add.image(0, y, iconKey)
        .setScale(SCALE.ITEM * 1.8)
        .setOrigin(0.5, 0.5);
      this.actionIndicator.add(icon);

      this.tweens.add({
        targets: [bg, icon],
        scale: { from: 0.5, to: 1.1 },
        duration: 180,
        ease: 'Back.easeOut',
        yoyo: true,
        hold: 350,
        onComplete: () => {
          this.tweens.add({
            targets: [bg, icon],
            alpha: 0,
            duration: 180,
            onComplete: () => this.actionIndicator.removeAll(true)
          });
        }
      });
    } else {
      this.tweens.add({
        targets: bg,
        scale: { from: 0.3, to: 1.4 },
        alpha: { from: 0.5, to: 0 },
        duration: 350,
        onComplete: () => this.actionIndicator.removeAll(true)
      });
    }
  }

  getItemColor(itemKey) {
    const colors = {
      [ITEM_KEYS.KNIFE]: 0xc62828,
      [ITEM_KEYS.MAGNIFYING_GLASS]: 0x4a90d9,
      [ITEM_KEYS.HANDCUFFS]: 0x888888,
      [ITEM_KEYS.BEER]: 0xf9a825,
      [ITEM_KEYS.CIGARETTE]: 0x43a047
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

    let wasLive = false;
    const isShot = action.type.startsWith("SHOOT");
    const isBeer = action.type === "USE_ITEM" && action.item === ITEM_KEYS.BEER;

    if ((isShot || isBeer) && prevChamberLength > 0) {
      wasLive = !!chamber[chamber.length - 1];
    }

    this.showActionIndicator(actorId, action.type, action.item);

    // Gun rotation logic
    let targetAngle = 0;
    if (action.type === "SHOOT_PLAYER") {
      targetAngle = (actorId === "YOU") ? -90 : 90;
    } else if (action.type === "SHOOT_SELF") {
      targetAngle = (actorId === "YOU") ? 90 : -90;
    }

    if (isShot) {
      this.isProcessing = true;
      this.tweens.add({
        targets: [this.gunSprite, this.crossedRevolversContainer],
        angle: targetAngle,
        duration: 280,
        ease: 'Cubic.easeOut'
      });
      this.time.delayedCall(350, () => {
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

      this.nextAmmoRevealed = null;
      this.nextAmmoSprite.setVisible(false);

      if (wasLive) {
        this.sound.play("sndGunshot");
      } else {
        this.sound.play("sndDryFire");
      }
      this.effects.playShootEffect(wasLive, action);

      this.crossedRevolversContainer.setVisible(false);
      this.gunSprite.setVisible(true);
      this.gunSprite.clearTint();

      this.state.players.forEach((p, i) => {
        if (p.health < prevHealth[i]) {
          this.effects.playDamageEffect(i);
        }
      });
    }

    if (action.type === "USE_ITEM") {
      this.effects.playItemEffect(action.item, actorId);

      if (isBeer && prevChamberLength > 0) {
        this.firedShots.push({ wasLive });
        this.effects.playBeerEffect(wasLive);
      }

      if (action.item === ITEM_KEYS.MAGNIFYING_GLASS) {
        this.revealNextAmmo();
      }

      if (action.item === ITEM_KEYS.CIGARETTE) {
        const idx = actorId === "YOU" ? 0 : 1;
        this.effects.playHealEffect(idx);
      }

      if (action.item === ITEM_KEYS.HANDCUFFS) {
        const targetIdx = actorId === "YOU" ? 1 : 0;
        this.effects.playHandcuffEffect(targetIdx);
      }

      if (action.item === ITEM_KEYS.KNIFE) {
        this.effects.playKnifeEffect();
      }
    }

    // Check if new round started
    if (this.state.shotgun.chamber.length > prevChamberLength) {
      this.time.delayedCall(450, () => {
        this.startRoundTimeout();
      });
    }

    this.render();

    if (action.type.startsWith("SHOOT")) {
      this.isProcessing = true;
      this.time.delayedCall(700, () => {
        this.isProcessing = false;
        this.tweens.add({
          targets: [this.gunSprite, this.crossedRevolversContainer],
          angle: 0,
          duration: 280,
          ease: 'Cubic.easeOut'
        });
        this.ai.checkTurn();
      });
    } else {
      this.time.delayedCall(80, () => {
        this.ai.checkTurn();
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
      scale: SCALE.AMMO * 1.4,
      duration: 280,
      ease: 'Back.easeOut'
    });

    const glow = this.add.circle(LAYOUT.CENTER_X, LAYOUT.NEXT_AMMO_ZONE.y, 22, nextRound ? 0xc62828 : 0x4a90d9, 0.35);
    this.tweens.add({
      targets: glow,
      scale: { from: 0.5, to: 1.8 },
      alpha: 0,
      duration: 450,
      onComplete: () => glow.destroy()
    });
  }

  // ==========================================================================
  // GAME SYSTEMS: VISUAL EFFECTS
  // ==========================================================================

  playShootEffect(wasLive, action) {
    if (wasLive) {
      const flash = this.add.circle(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y, 35, 0xffcc00, 1);
      this.tweens.add({
        targets: flash,
        scale: { from: 0.3, to: 1.4 },
        alpha: { from: 1, to: 0 },
        duration: 180,
        onComplete: () => flash.destroy()
      });

      this.triggerEffect("shake", { duration: 120, intensity: 0.006 });

      this.tweens.add({
        targets: this.gunSprite,
        angle: { from: this.gunSprite.angle - 8, to: this.gunSprite.angle },
        duration: 180,
        ease: 'Back.easeOut'
      });

      this.triggerEffect("flash", { color: 0xc62828, alpha: 0.2, duration: 250 });
    } else {
      // Dry fire - softer effect
      const puff = this.add.circle(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y - 12, 12, 0x4a90d9, 0.5);
      this.tweens.add({
        targets: puff,
        scale: { from: 0.5, to: 1.8 },
        alpha: 0,
        y: LAYOUT.GUN_ZONE.y - 35,
        duration: 320,
        onComplete: () => puff.destroy()
      });

      // Subtle wobble
      this.tweens.add({
        targets: this.gunSprite,
        angle: { from: this.gunSprite.angle - 2, to: this.gunSprite.angle + 2 },
        duration: 60,
        yoyo: true,
        repeat: 1
      });
    }
  }

  playDamageEffect(playerIndex) {
    const pc = this.playerContainers[playerIndex];

    pc.avatar.setTint(0xc62828);
    this.time.delayedCall(130, () => {
      pc.avatar.clearTint();
    });

    const hearts = pc.heartContainer.list;
    if (hearts.length > 0) {
      const lastFullHeartIdx = hearts.findLastIndex(h => h.texture.key === "heartFull");
      const targetHeart = lastFullHeartIdx !== -1 ? hearts[lastFullHeartIdx] : null;

      if (targetHeart) {
        this.tweens.add({
          targets: targetHeart,
          y: targetHeart.y - 12,
          scale: SCALE.HEART * 1.4,
          alpha: 0,
          duration: 280,
          ease: 'Back.easeIn',
          onComplete: () => {
            targetHeart.setTexture("heartEmpty");
            targetHeart.y = 0;
            targetHeart.alpha = 0.4;
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
    for (let i = 0; i < 5; i++) {
      const sparkle = this.add.circle(
        LAYOUT.CENTER_X + Phaser.Math.Between(-35, 35),
        baseY + Phaser.Math.Between(-15, 15),
        4,
        color,
        0.8
      );
      this.tweens.add({
        targets: sparkle,
        scale: { from: 1, to: 0 },
        y: sparkle.y - 25,
        alpha: 0,
        duration: 350,
        delay: i * 40,
        onComplete: () => sparkle.destroy()
      });
    }
  }

  playBeerEffect(wasLive) {
    const color = wasLive ? 0xc62828 : 0x4a90d9;
    const eject = this.add.circle(LAYOUT.CENTER_X + 28, LAYOUT.GUN_ZONE.y, 7, color, 0.9);
    this.tweens.add({
      targets: eject,
      x: LAYOUT.CENTER_X + 90,
      y: LAYOUT.GUN_ZONE.y + 45,
      rotation: 2.5,
      alpha: 0,
      duration: 450,
      onComplete: () => eject.destroy()
    });
  }

  playHealEffect(playerIndex) {
    const pc = this.playerContainers[playerIndex];

    pc.avatar.setTint(0x43a047);
    this.time.delayedCall(280, () => {
      pc.avatar.clearTint();
    });

    for (let i = 0; i < 3; i++) {
      const plus = this.add.circle(
        pc.container.x + Phaser.Math.Between(-18, 18),
        pc.container.y - 18,
        5,
        0x43a047,
        0.7
      );
      this.tweens.add({
        targets: plus,
        y: plus.y - 35,
        alpha: 0,
        duration: 550,
        delay: i * 80,
        onComplete: () => plus.destroy()
      });
    }
  }

  playHandcuffEffect(targetIndex) {
    const pc = this.playerContainers[targetIndex];

    const chain = this.add.image(pc.container.x, pc.container.y, "itemHandcuffs")
      .setScale(0.28)
      .setAlpha(0);

    this.tweens.add({
      targets: chain,
      alpha: 1,
      scale: 0.14,
      duration: 280,
      yoyo: true,
      hold: 280,
      onComplete: () => chain.destroy()
    });

    pc.avatar.setTint(0x666666);
    this.time.delayedCall(380, () => {
      pc.avatar.clearTint();
    });
  }

  playKnifeEffect() {
    this.crossedRevolversContainer.setVisible(true);
    this.crossedRevolversContainer.setAlpha(0);
    this.crossedRevolversContainer.setScale(0.3);

    this.gunSprite.setVisible(false);

    this.gunLeft.setTint(0xc62828);
    this.gunRight.setTint(0xc62828);

    this.tweens.add({
      targets: this.crossedRevolversContainer,
      alpha: 1,
      scale: 1,
      duration: 280,
      ease: 'Back.easeOut'
    });

    const slash = this.add.rectangle(LAYOUT.CENTER_X - 18, LAYOUT.GUN_ZONE.y, 55, 3, 0xc62828, 1)
      .setAngle(-45);
    this.tweens.add({
      targets: slash,
      x: LAYOUT.CENTER_X + 18,
      alpha: 0,
      duration: 180,
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

      this.showThinkingIndicator(true);

      this.time.delayedCall(1100 + Math.random() * 700, () => {
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
        scale: SCALE.AVATAR * 1.08,
        alpha: 0.85,
        duration: 350,
        yoyo: true,
        repeat: -1
      });
    } else {
      this.tweens.killTweensOf(pc.avatar);
      pc.avatar.setScale(SCALE.AVATAR);
      pc.avatar.setAlpha(1);
    }
  }

  setupButtonFeedback(button, baseScale, callback) {
    button.setInteractive({ useHandCursor: true });

    button.on("pointerdown", () => {
      this.tweens.add({
        targets: button,
        scale: baseScale * 0.88,
        duration: 70,
        ease: 'Cubic.easeOut'
      });
      callback();
    });

    button.on("pointerup", () => {
      this.tweens.add({
        targets: button,
        scale: baseScale * 1.08,
        duration: 100,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: button,
            scale: baseScale,
            duration: 130
          });
        }
      });
    });

    button.on("pointerout", () => {
      this.tweens.add({
        targets: button,
        scale: baseScale,
        duration: 130
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
      this.btnShootBot.setAlpha(1);
      this.btnShootSelf.setAlpha(0.9);
    } else {
      this.btnShootBot.disableInteractive();
      this.btnShootSelf.disableInteractive();
      this.btnShootBot.setTint(COLORS.TINT_DISABLED);
      this.btnShootSelf.setTint(COLORS.TINT_DISABLED);
      this.btnShootBot.setAlpha(0.35);
      this.btnShootSelf.setAlpha(0.3);
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

      // Turn emphasis system
      if (isCurrentTurn && player.alive) {
        pc.avatar.setAlpha(1);
        pc.avatar.setScale(SCALE.AVATAR * 1.12);
        // Show glow ring
        pc.glowRing.setFillStyle(0x4a90d9, 0.15);
        this.tweens.add({
          targets: pc.glowRing,
          alpha: { from: 0.5, to: 0.2 },
          scale: { from: 1, to: 1.1 },
          duration: 800,
          yoyo: true,
          repeat: -1
        });
      } else if (player.alive) {
        pc.avatar.setAlpha(0.55);
        pc.avatar.setScale(SCALE.AVATAR * 0.95);
        this.tweens.killTweensOf(pc.glowRing);
        pc.glowRing.setAlpha(0);
      } else {
        pc.avatar.setAlpha(0.35);
        pc.avatar.setScale(SCALE.AVATAR);
        this.tweens.killTweensOf(pc.glowRing);
        pc.glowRing.setAlpha(0);
      }

      // Heart rendering
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

        if (heart.texture.key !== targetTexture) {
          heart.setTexture(targetTexture);
        }

        // Visual weight based on turn
        heart.setAlpha(isCurrentTurn ? (isFull ? 1 : 0.35) : (isFull ? 0.5 : 0.18));
      });
    });

    // Update HUD with animation on changes
    if (this.hudRound) {
      const newRoundText = `Round ${this.state.roundNumber}`;
      if (this.hudRound.text !== newRoundText) {
        this.tweens.add({
          targets: this.hudRound,
          scale: { from: 1, to: 1.15 },
          duration: 150,
          yoyo: true,
          onStart: () => this.hudRound.setText(newRoundText)
        });
      }
    }

    if (this.hudTurn) {
      const currentActor = players[currentTurnIdx];
      const turnName = currentActor.id === "YOU" ? "Your Turn" : "Dealer's Turn";
      const turnColor = currentActor.id === "YOU" ? COLORS.SUCCESS : COLORS.DANGER;

      if (this.hudTurn.text !== turnName) {
        this.tweens.add({
          targets: [this.hudTurn, this.turnBg],
          alpha: { from: 1, to: 0 },
          duration: 120,
          onComplete: () => {
            this.hudTurn.setText(turnName);
            this.hudTurn.setColor(turnColor);
            this.turnBg.setStrokeStyle(1, currentActor.id === "YOU" ? 0x43a047 : 0xc62828);
            this.tweens.add({
              targets: [this.hudTurn, this.turnBg],
              alpha: { from: 0, to: 1 },
              duration: 120
            });
          }
        });

        // Turn glow pulse
        this.turnGlow.setStrokeStyle(2, currentActor.id === "YOU" ? 0x43a047 : 0xc62828);
        this.tweens.add({
          targets: this.turnGlow,
          alpha: { from: 0, to: 0.6 },
          duration: 300,
          yoyo: true
        });
      }
    }

    this.renderAmmo();
    this.updateButtonStates();

    // Items rendering
    const canUseItems = !this.ammoRevealPhase && !this.betweenRounds;
    this.playerItemsContainer.removeAll(true);
    this.renderItems(this.playerItemsContainer, players[0].items, canUseItems, false);

    this.botItemsContainer.removeAll(true);
    this.renderItems(this.botItemsContainer, players[1].items, false, true);

    if (this.state.gameOver && !this.restartBtn) {
      const winner = players.find(p => p.alive);
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
            () => this.scene.restart({ playerName: this.playerName }), // Play again callback
            () => {
              // Quit to menu callback
              window.location.reload();
            }
          );
        });
      }

      // Create a simple Phaser overlay to dim the game
      const overlay = this.add.rectangle(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2, LAYOUT.WIDTH, LAYOUT.HEIGHT, 0x000000, 0.7)
        .setDepth(100);

      this.tweens.add({
        targets: overlay,
        alpha: 0.7,
        duration: 300
      });

      this.restartBtn = true; // Mark that game over has been handled
    }
  }

  // ==========================================================================
  // RENDER ITEMS
  // ==========================================================================
  renderItems(container, items, isInteractive, isDealer) {
    const itemSpacing = 36;
    const startX = -((Math.min(items.length, 6) - 1) * itemSpacing) / 2;

    items.forEach((item, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const tx = startX + col * itemSpacing;
      const ty = row * 32;

      const assetKey = ITEM_ASSET_MAP[item];
      if (!assetKey) return;

      const icon = this.add.image(tx, ty, assetKey)
        .setScale(SCALE.ITEM)
        .setOrigin(0.5, 0.5);

      // Dealer items de-emphasized
      if (isDealer) {
        icon.setAlpha(0.5);
        icon.setTint(0xaaaaaa);
      }

      // Disabled during reveal/timeout phases
      if (this.ammoRevealPhase || this.betweenRounds) {
        icon.setTint(COLORS.TINT_DISABLED);
        icon.setAlpha(0.4);
      }

      if (isInteractive && !this.ammoRevealPhase && !this.betweenRounds) {
        icon.setInteractive({ useHandCursor: true });

        // Subtle hover effect (scale + slight glow)
        icon.on("pointerover", () => {
          this.tweens.add({
            targets: icon,
            scale: SCALE.ITEM * 1.12,
            duration: 100
          });
        });

        icon.on("pointerout", () => {
          this.tweens.add({
            targets: icon,
            scale: SCALE.ITEM,
            duration: 100
          });
        });

        icon.on("pointerdown", () => this.onItemAction(item));
      }

      container.add(icon);
    });
  }
}
