
import { StartScene } from "./StartScene.js";
import { GameScene } from "./GameScene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: "#000",
  scene: [StartScene, GameScene]
});
