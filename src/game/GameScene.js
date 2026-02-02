import { applyAction, createInitialState, refillShotgun, giveItems, ITEM_KEYS } from "./gameLogic.js";
import { ASSETS, SOUNDS, ITEM_ASSET_MAP, LAYOUT, SCALE, COLORS, FONTS, AVATAR_KEYS } from "./LayoutConfig.js";
import { EffectsManager } from "./EffectsManager.js";
import { AIController } from "./AIController.js";


export class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  init(data) {
    this.playerName = data.playerName || "YOU";
  }

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
    this.targetedIndex = null;

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
    // Round indicator panel (top-left) - Styled
    const roundPanel = this.add.container(60, 25);
    const roundBg = this.add.rectangle(0, 0, 90, 32, COLORS.PANEL_BG, 0.95)
      .setStrokeStyle(1, COLORS.PANEL_BORDER);

    // Manual rounded corners not supported on Rectangle directly in all Phaser versions easily without Texture or Graphics.
    // Using Graphics for rounded background
    const roundBgGraphics = this.add.graphics();
    roundBgGraphics.fillStyle(COLORS.PANEL_BG, 0.95);
    roundBgGraphics.lineStyle(1, COLORS.PANEL_BORDER);
    roundBgGraphics.fillRoundedRect(-45, -16, 90, 32, 8);
    roundBgGraphics.strokeRoundedRect(-45, -16, 90, 32, 8);
    roundBg.setVisible(false); // Hide the simple rect

    this.hudRound = this.add.text(0, -1, "Round 1", {
      ...FONTS.LABEL,
      fontSize: "13px"
    }).setOrigin(0.5);
    roundPanel.add([roundBgGraphics, this.hudRound]);

    // Turn indicator panel (top-right)
    // Turn indicator panel (top-right) - Styled
    const turnPanel = this.add.container(LAYOUT.WIDTH - 70, 25);

    const turnBgGraphics = this.add.graphics();
    turnBgGraphics.fillStyle(COLORS.PANEL_BG, 0.95);
    turnBgGraphics.lineStyle(1, COLORS.PANEL_BORDER);
    turnBgGraphics.fillRoundedRect(-60, -16, 120, 32, 8);
    turnBgGraphics.strokeRoundedRect(-60, -16, 120, 32, 8);

    this.hudTurn = this.add.text(0, -1, "Your Turn", {
      ...FONTS.LABEL,
      fontSize: "13px"
    }).setOrigin(0.5);
    this.turnBg = turnBgGraphics; // Updated reference to graphics
    this.turnPanel = turnPanel;
    turnPanel.add([turnBgGraphics, this.hudTurn]);

    // Turn glow indicator (Rounded)
    this.turnGlow = this.add.graphics();
    this.turnGlow.lineStyle(2, 0x4a90d9);
    this.turnGlow.strokeRoundedRect(LAYOUT.WIDTH - 70 - 62, 25 - 18, 124, 36, 10);
    this.turnGlow.setAlpha(0);
  }

  // ==========================================================================
  // AVATAR STATES
  // ==========================================================================
  updateAvatarStates() {
    if (!this.playerContainers) return;

    this.playerContainers.forEach((pc, index) => {
      const player = this.state.players[index];
      const isCurrentTurn = (index === this.state.currentTurnIndex);
      const isDead = player.health <= 0;
      const isTargeted = (index === this.targetedIndex);

      let textureKey;
      if (player.id === "BOT") {
        if (isDead) textureKey = AVATAR_KEYS.BOT_DEAD;
        else if (isTargeted) textureKey = AVATAR_KEYS.BOT_SELECTED;
        else if (isCurrentTurn) textureKey = AVATAR_KEYS.BOT_ACTIVE;
        else textureKey = AVATAR_KEYS.BOT;
      } else {
        if (isDead) textureKey = AVATAR_KEYS.PLAYER_DEAD;
        else if (isTargeted) textureKey = AVATAR_KEYS.PLAYER_SELECTED;
        else if (isCurrentTurn) textureKey = AVATAR_KEYS.PLAYER_ACTIVE;
        else textureKey = AVATAR_KEYS.PLAYER;
      }

      pc.avatar.setTexture(textureKey);

      // Main depth and basic state visuals
      if (isDead) {
        pc.avatar.setTint(0x555555);
        pc.avatar.setAlpha(0.6);
        pc.glowRing.setAlpha(0);
      } else if (isCurrentTurn) {
        pc.avatar.clearTint();
        pc.avatar.setAlpha(1);

        // Pulse Glow
        this.tweens.killTweensOf(pc.glowRing);
        pc.glowRing.setAlpha(0.4);
        this.tweens.add({
          targets: pc.glowRing,
          alpha: 0.1,
          scale: 1.1,
          duration: 800,
          yoyo: true,
          repeat: -1
        });

        // Slight scale up for active avatar
        this.tweens.add({
          targets: pc.avatar,
          scale: SCALE.AVATAR * 1.05,
          duration: 400
        });
      } else {
        // Idle
        pc.avatar.clearTint();
        pc.avatar.setAlpha(0.8);
        pc.glowRing.setAlpha(0);

        this.tweens.add({
          targets: pc.avatar,
          scale: SCALE.AVATAR,
          duration: 400
        });
      }
    });
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

      // Avatar Setup - Created ONCE, single texture swap model
      const initialKey = pos.id === "BOT" ? AVATAR_KEYS.BOT : AVATAR_KEYS.PLAYER;
      const avatar = this.add.image(0, 0, initialKey)
        .setOrigin(0.5, 0.5)
        .setScale(SCALE.AVATAR)
        .setAlpha(1);

      // Glow Ring (Active State)
      const glowRing = this.add.circle(0, 0, 55, 0x4a90d9, 0);

      // Name Text & Background (Applied to all players as requested)
      const nameY = 40;
      const heartY = 60;

      const nameText = this.add.text(0, nameY, pos.name, {
        ...FONTS.BODY,
        fontSize: "12px",
        fontStyle: "bold",
        color: COLORS.TEXT_PRIMARY
      }).setOrigin(0.5).setDepth(2);

      // Graphics for rounded black BG
      const nameBg = this.add.graphics();
      nameBg.fillStyle(0x000000, 0.85);

      // Dynamic padding for the name background
      const bgW = nameText.width + 20;
      const bgH = nameText.height + 6;
      nameBg.fillRoundedRect(-bgW / 2, nameY - bgH / 2, bgW, bgH, 10);
      nameBg.setDepth(1);

      const heartContainer = this.add.container(0, heartY);
      container.add([glowRing, avatar, nameBg, nameText, heartContainer]);

      this.playerContainers[i] = {
        container,
        avatar,
        heartContainer,
        glowRing,
        id: pos.id,
        nameText,
        nameBg
      };

      // High depth to ensure they are on top
      container.setDepth(10);


      // Subtle idle breathing
      this.tweens.add({
        targets: container,
        y: pos.y + (i === 0 ? 3 : -3),
        duration: 2500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    // Initial state check
    this.updateAvatarStates();
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

    // Crossed revolvers sprite (Visual replacement for knife logic)
    this.crossedRevolversSprite = this.add.image(LAYOUT.CENTER_X, LAYOUT.GUN_ZONE.y, "crossedRevolvers")
      .setScale(SCALE.GUN)
      .setOrigin(0.5, 0.5)
      .setVisible(false);
  }

  setupUI() {
    // Ammo container
    this.ammoContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.AMMO_ZONE.y);

    // Buttons - Dynamic Bottom Layout
    // No hardcoded spacing. Fit to width.

    const margin = 8;
    const gap = 8;
    const availableWidth = LAYOUT.WIDTH - (margin * 2);
    const btnWidth = (availableWidth - gap) / 2;
    const btnY = LAYOUT.HEIGHT - 32; // Anchored slightly lower if margin is smaller

    // Shoot Dealer (Left)
    this.btnShootBot = this.add.image(margin + btnWidth / 2, btnY, "btnShootPlayerIdle")
      // .setScale(SCALE.BUTTON) // We will scale to fit width instead of fixed scale
      .setOrigin(0.5, 0.5);

    // Auto-scale to fit constrained width if needed, or stick to consistent size if it fits?
    // "Scale buttons proportionally to fill buttonWidth" -> implication: buttons should be wide.
    // Our buttons are icons. Let's just center them in their zones, or scale them to be large hit targets.
    // Let's keep aspect ratio but maximize size within the slot.
    const idealHeight = 60;
    const scaleX = btnWidth / this.btnShootBot.width;
    const scaleY = idealHeight / this.btnShootBot.height;
    const finalScale = Math.min(scaleX, scaleY, 0.8); // 0.8 max to not be huge

    this.btnShootBot.setScale(finalScale);

    this.setupButtonFeedback(this.btnShootBot, "btnShootPlayer", finalScale, () =>
      this.onPlayerAction({ type: "SHOOT_PLAYER", playerId: "YOU", targetId: "BOT" }));

    // Shoot Self (Right)
    this.btnShootSelf = this.add.image(margin + btnWidth + gap + btnWidth / 2, btnY, "btnShootSelfIdle")
      .setScale(finalScale)
      .setOrigin(0.5, 0.5);

    this.setupButtonFeedback(this.btnShootSelf, "btnShootSelf", finalScale, () =>
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
    this.crossedRevolversSprite.setAngle(0);

    console.log(`[STATE] New Round Started. Chamber: ${this.roundStartLive} Live, ${this.roundStartBlank} Blank`);

    // Play spin sound
    this.sound.play("sndSpin");

    // LOADING TEXT REMOVED - Visuals only

    this.render();

    this.render();

    // Disable all actions for 3 seconds
    this.time.delayedCall(3000, () => {
      // Reveal ended


      // Soft exit for reveal phase
      this.tweens.add({
        targets: this.ammoContainer,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          this.ammoRevealPhase = false;
          this.render();
          this.ammoContainer.setAlpha(1);
          this.ammoContainer.setAlpha(1);
          this.ai.checkTurn(); // Triggers first turn
          this.updateAvatarStates();
        }
      });
    });
  }

  // Start new round with timeout
  startRoundTimeout() {
    this.betweenRounds = true;
    this.render();

    this.sound.play("sndReload");

    // Reload Text REMOVED - Visuals only
    // Replaced by simple icon or audio cue primarily

    // We can keep a small subtle icon if needed, but text is forbidden under items.
    // The ammo reveal sequence follows shortly.

    const reloadContainer = this.add.container(LAYOUT.CENTER_X, LAYOUT.HEIGHT / 2);
    // JUST ANIMATION - No Text
    // Maybe a spinning cylinder icon? For now, we rely on the sound and the delay.

    this.tweens.add({
      targets: reloadContainer,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.9, to: 1 },
      duration: 200,
      ease: 'Back.easeOut'
    });

    // Simplified Reload Animation (Pulse only if anything)
    // Actually, destroying the container logic below handles cleanup.
    // We already removed the text content.

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

    let wasLive = false;
    const isShot = action.type.startsWith("SHOOT");
    const isBeer = action.type === "USE_ITEM" && action.item === ITEM_KEYS.BEER;

    if ((isShot || isBeer) && prevChamberLength > 0) {
      wasLive = !!chamber[chamber.length - 1];
    }

    this.showActionIndicator(actorId, action.type, action.item);

    // Gun rotation logic - EXPLICIT TARGETING
    let targetAngle = 0;

    if (action.type === "SHOOT_PLAYER") {
      this.targetedIndex = (actorId === "YOU" ? 1 : 0);
    } else if (action.type === "SHOOT_SELF") {
      this.targetedIndex = (actorId === "YOU" ? 0 : 1);
    }

    // Set angle based on target's vertical position relative to gun
    // Index 1 (BOT) is at the top -> point UP
    // Index 0 (YOU) is at the bottom -> point DOWN
    // According to user, -90 points to the Bot when the Bot acts, 
    // but points to themselves when they act. This implies the asset/phaser 
    // setup treats 90 as "towards the Bot (Top)" and -90 as "towards You (Bottom)".
    targetAngle = (this.targetedIndex === 1 ? 90 : -90);

    this.updateAvatarStates();

    if (isShot) {
      this.isProcessing = true;

      // Ensure gun is on top
      this.gunSprite.setDepth(20);

      console.log("Target angle: " + targetAngle);

      this.tweens.add({
        targets: this.gunSprite,
        angle: targetAngle,
        duration: 200,
        ease: 'Cubic.easeOut'
      });


      this.time.delayedCall(300, () => {
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

      this.crossedRevolversSprite.setVisible(false);
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
      this.targetedIndex = null;
      this.isProcessing = true;
      this.time.delayedCall(700, () => {
        this.isProcessing = false;

        // Reset Gun to Neutral (0)
        this.tweens.add({
          targets: [this.gunSprite, this.crossedRevolversSprite],
          angle: 0,
          duration: 280,
          ease: 'Cubic.easeOut'
        });

        this.ai.checkTurn();

        // Update avatars safely
        this.updateAvatarStates();
      });
    } else {
      this.time.delayedCall(80, () => {
        this.ai.checkTurn();
        this.updateAvatarStates();
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


  // ==========================================================================
  // AI TURN
  // ==========================================================================
  checkAITurn() {
    if (this.state.gameOver || this.ammoRevealPhase || this.betweenRounds) return;

    const actor = this.state.players[this.state.currentTurnIndex];
    this.updateButtonStates();

    // Reset knife visuals if damage is back to 1
    if (this.state.shotgun.damage === 1) {
      this.crossedRevolversSprite.setVisible(false);
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

  setupButtonFeedback(button, baseKey, baseScale, callback) {
    button.setInteractive({ useHandCursor: true });

    button.on("pointerdown", () => {
      button.setTexture(baseKey + "Pressed");
      this.tweens.add({
        targets: button,
        scale: baseScale * 0.88,
        duration: 70,
        ease: 'Cubic.easeOut'
      });
      callback();
    });

    button.on("pointerup", () => {
      button.setTexture(baseKey + "Idle");
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
      button.setTexture(baseKey + "Idle");
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
      this.btnShootBot.setTexture("btnShootPlayerIdle");
      this.btnShootSelf.setTexture("btnShootSelfIdle");
      this.btnShootBot.clearTint();
      this.btnShootSelf.clearTint();
      this.btnShootBot.setAlpha(1);
      this.btnShootSelf.setAlpha(1);
    } else {
      this.btnShootBot.disableInteractive();
      this.btnShootSelf.disableInteractive();
      this.btnShootBot.setTexture("btnShootPlayerDisabled");
      this.btnShootSelf.setTexture("btnShootSelfDisabled");
      this.btnShootBot.clearTint();
      this.btnShootSelf.clearTint();
      this.btnShootBot.setAlpha(1);
      this.btnShootSelf.setAlpha(1);
    }
  }

  render() {
    const players = this.state.players;
    const currentTurnIdx = this.state.currentTurnIndex;

    this.updateAvatarStates();

    players.forEach((player, i) => {
      const pc = this.playerContainers[i];
      const isCurrentTurn = i === currentTurnIdx;

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
      const turnColorHex = currentActor.id === "YOU" ? 0x43a047 : 0xc62828;

      if (this.hudTurn.text !== turnName) {
        this.tweens.add({
          targets: [this.hudTurn, this.turnBg],
          alpha: { from: 1, to: 0 },
          duration: 120,
          onComplete: () => {
            this.hudTurn.setText(turnName);
            this.hudTurn.setColor(turnColor);

            // Update Graphics Stroke
            this.turnBg.clear();
            this.turnBg.fillStyle(COLORS.PANEL_BG, 0.95);
            this.turnBg.lineStyle(1, turnColorHex);
            this.turnBg.fillRoundedRect(-60, -16, 120, 32, 8);
            this.turnBg.strokeRoundedRect(-60, -16, 120, 32, 8);

            this.tweens.add({
              targets: [this.hudTurn, this.turnBg],
              alpha: { from: 0, to: 1 },
              duration: 120
            });

            // Single Pulse on turn start (If it's YOUR turn)
            if (currentActor.id === "YOU") {
              this.turnGlow.clear();
              this.turnGlow.lineStyle(2, 0x43a047);
              this.turnGlow.strokeRoundedRect(LAYOUT.WIDTH - 70 - 62, 25 - 18, 124, 36, 10);

              this.turnGlow.setAlpha(0.8);
              this.tweens.add({
                targets: this.turnGlow,
                alpha: 0,
                scaleX: 1.05,
                scaleY: 1.1,
                duration: 500,
                ease: 'Quad.out'
              });
            }
          }
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
      const assetKey = ITEM_ASSET_MAP[item];
      const col = i % 6;
      const row = Math.floor(i / 6);
      const tx = startX + col * itemSpacing;
      const ty = row * 42; // Slightly increased row spacing

      // Item Size Normalization
      // Preservation of aspect ratio while targeting max 64px
      const icon = this.add.image(tx, ty, assetKey);

      const maxDim = 32;
      const scale = Math.min(maxDim / icon.width, maxDim / icon.height);
      icon.setScale(scale);

      if (icon.texture) {
        icon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }

      icon.setOrigin(0.5, 0.5);

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

      const baseScale = icon.scaleX;

      if (isInteractive && !this.ammoRevealPhase && !this.betweenRounds) {
        icon.setInteractive({ useHandCursor: true });

        // Subtle hover effect (scale + slight glow)
        icon.on("pointerover", () => {
          this.tweens.add({
            targets: icon,
            scale: baseScale * 1.12,
            duration: 100
          });
        });

        icon.on("pointerout", () => {
          this.tweens.add({
            targets: icon,
            scale: baseScale,
            duration: 100
          });
        });

        icon.on("pointerdown", () => this.onItemAction(item));
      }

      container.add(icon);
    });
  }
}
