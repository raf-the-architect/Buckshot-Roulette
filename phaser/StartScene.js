
export class StartScene extends Phaser.Scene {
  constructor() {
    super("StartScene");
  }

  preload() {
    this.load.image("bg", "assets/background.png");
    this.load.image("btnStart", "assets/shoot-player_btn.png");
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background
    this.add.image(width / 2, height / 2, "bg").setDisplaySize(width, height);

    // Title
    this.add.text(width / 2, height * 0.25, "BUCKSHOT\nROULETTE", {
      fontFamily: "Arial",
      fontSize: "48px",
      color: "#ff0000",
      align: "center",
      stroke: "#000000",
      strokeThickness: 8
    }).setOrigin(0.5);

    // Prompt
    this.add.text(width / 2, height * 0.45, "ENTER YOUR NAME:", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5);

    // Name Display
    let playerName = "PLAYER";
    const nameText = this.add.text(width / 2, height * 0.52, playerName, {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#ffff00",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    // Interactive name input (simple)
    this.input.keyboard.on("keydown", (event) => {
      if (event.keyCode === 8 && playerName.length > 0) {
        playerName = playerName.slice(0, -1);
      } else if (event.keyCode >= 65 && event.keyCode <= 90 && playerName.length < 12) {
        playerName += event.key;
      } else if (event.keyCode === 13) {
        this.startGame(playerName);
      }
      nameText.setText(playerName.toUpperCase());
    });

    // Start Button
    const startBtn = this.add.image(width / 2, height * 0.7, "btnStart")
      .setScale(0.6);
    
    this.add.text(width / 2, height * 0.7, "START", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5);

    this.setupButtonFeedback(startBtn, () => {
      this.startGame(playerName);
    });

    // Instructions
    this.add.text(width / 2, height * 0.85, "Type your name and press START\n(or ENTER)", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#aaaaaa",
      align: "center"
    }).setOrigin(0.5);
  }

  startGame(name) {
    if (!name || name.trim() === "") name = "PLAYER";
    this.scene.start("Game", { playerName: name.toUpperCase() });
  }

  setupButtonFeedback(button, callback) {
    button.setInteractive({ useHandCursor: true });
    
    button.on("pointerdown", () => {
      this.tweens.add({
        targets: button,
        scale: 0.55,
        duration: 80,
        ease: 'Cubic.easeOut'
      });
      callback();
    });
    
    button.on("pointerup", () => {
      this.tweens.add({
        targets: button,
        scale: 0.65,
        duration: 120,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: button,
            scale: 0.6,
            duration: 150
          });
        }
      });
    });

    button.on("pointerout", () => {
      this.tweens.add({
        targets: button,
        scale: 0.6,
        duration: 150
      });
    });
  }
}
