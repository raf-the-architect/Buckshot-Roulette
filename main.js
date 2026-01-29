
import { GameScene } from "./GameScene.js";
import { StartScreen } from "./ui.js";

// Initialize UI
new StartScreen((playerName) => {
  launchGame(playerName);
});

function launchGame(playerName) {
  const config = {
    type: Phaser.AUTO,
    width: 360,
    height: 640,
    backgroundColor: "#000",
    parent: document.body, // Ensure it appends correctly
    scene: [GameScene],
    // We remove StartScene entirely as the DOM UI replaces it
  };

  const game = new Phaser.Game(config);

  // Pass data to the first scene
  game.scene.start("Game", { playerName: playerName });
}
