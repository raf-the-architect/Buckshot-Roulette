
export class StartScene extends Phaser.Scene {
  constructor() {
    super("StartScene");
  }

  preload() {
    this.load.image("bg", "assets/background.png");
    // No button asset needed - using styled rectangle
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background
    this.add.image(width / 2, height / 2, "bg").setDisplaySize(width, height);

    // Semi-transparent overlay for better text contrast
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.4);

    // Title with refined styling
    const title = this.add.text(width / 2, height * 0.18, "Buckshot\nRoulette", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "42px",
      fontStyle: "bold",
      color: "#ffffff",
      align: "center",
      stroke: "#1a1a1a",
      strokeThickness: 4,
      lineSpacing: 4
    }).setOrigin(0.5);

    // Subtle breathing animation for title
    this.tweens.add({
      targets: title,
      scale: { from: 1, to: 1.02 },
      alpha: { from: 1, to: 0.9 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Name input section
    const inputY = height * 0.45;

    // Section label
    this.add.text(width / 2, inputY - 45, "Enter your name", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "500",
      color: "#a0a0a0"
    }).setOrigin(0.5);

    // Name display with input styling
    let playerName = "PLAYER";

    // Input background (rounded rectangle simulation)
    const inputBg = this.add.rectangle(width / 2, inputY, 180, 44, 0x2a2a2a, 1)
      .setStrokeStyle(2, 0x444444);

    // Input focus glow (hidden initially)
    const inputGlow = this.add.rectangle(width / 2, inputY, 188, 52, 0x4a90d9, 0)
      .setStrokeStyle(3, 0x4a90d9);

    const nameText = this.add.text(width / 2, inputY, playerName, {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "22px",
      fontStyle: "600",
      color: "#ffffff",
      padding: { x: 12, y: 8 }
    }).setOrigin(0.5);

    // Cursor blink animation
    const cursor = this.add.text(width / 2 + nameText.width / 2 + 4, inputY, "|", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "22px",
      color: "#4a90d9"
    }).setOrigin(0, 0.5);

    this.tweens.add({
      targets: cursor,
      alpha: { from: 1, to: 0 },
      duration: 530,
      yoyo: true,
      repeat: -1
    });

    // Focus state animation
    this.tweens.add({
      targets: inputGlow,
      alpha: { from: 0.3, to: 0.6 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Keyboard input handling
    this.input.keyboard.on("keydown", (event) => {
      if (event.keyCode === 8 && playerName.length > 0) {
        playerName = playerName.slice(0, -1);
      } else if (event.keyCode >= 65 && event.keyCode <= 90 && playerName.length < 10) {
        playerName += event.key.toUpperCase();
      } else if (event.keyCode === 13) {
        this.startGame(playerName);
      }
      nameText.setText(playerName || "_");
      cursor.setX(width / 2 + nameText.width / 2 + 4);
    });

    // Start Button - Primary CTA (custom styled, not using game asset)
    const btnY = height * 0.62;

    // Button glow effect (pulsing)
    const btnGlow = this.add.ellipse(width / 2, btnY, 160, 55, 0x4a90d9, 0.25);
    this.tweens.add({
      targets: btnGlow,
      scaleX: { from: 1, to: 1.12 },
      scaleY: { from: 1, to: 1.18 },
      alpha: { from: 0.25, to: 0.08 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Button container with styled rectangle
    const btnContainer = this.add.container(width / 2, btnY);

    const btnBg = this.add.rectangle(0, 0, 150, 48, 0x2563eb, 1)
      .setStrokeStyle(2, 0x3b82f6);

    const btnText = this.add.text(0, 0, "Start Game", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "700",
      color: "#ffffff"
    }).setOrigin(0.5);

    btnContainer.add([btnBg, btnText]);

    this.setupButtonFeedback(btnContainer, btnBg, () => {
      this.startGame(playerName);
    });

    // Instructions
    this.add.text(width / 2, height * 0.78, "Type your name and press Start\nor press Enter", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "12px",
      color: "#666666",
      align: "center",
      lineSpacing: 4
    }).setOrigin(0.5);

    // Decorative element - subtle divider
    const divider = this.add.rectangle(width / 2, height * 0.88, 80, 2, 0x333333);

    // Version/credits text
    this.add.text(width / 2, height * 0.93, "A game of chance and consequences", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "10px",
      fontStyle: "italic",
      color: "#444444"
    }).setOrigin(0.5);
  }

  startGame(name) {
    if (!name || name.trim() === "") name = "PLAYER";
    this.scene.start("Game", { playerName: name.toUpperCase() });
  }

  setupButtonFeedback(container, btnBg, callback) {
    btnBg.setInteractive({ useHandCursor: true });

    btnBg.on("pointerover", () => {
      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 120,
        ease: 'Back.easeOut'
      });
    });

    btnBg.on("pointerout", () => {
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 120
      });
    });

    btnBg.on("pointerdown", () => {
      this.tweens.add({
        targets: container,
        scale: 0.95,
        duration: 70,
        ease: 'Cubic.easeOut'
      });
      callback();
    });

    btnBg.on("pointerup", () => {
      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 100,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: container,
            scale: 1,
            duration: 120
          });
        }
      });
    });
  }
}
