/**
 * AIController.js
 * Handles AI turn logic and thinking indicator
 */

import { decideAIAction } from "./ai.js";

export class AIController {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Get current scale dynamically from scene
     */
    getScale() {
        return this.scene.getScale();
    }

    // ==========================================================================
    // AI TURN CHECK
    // ==========================================================================
    checkTurn() {
        const scene = this.scene;

        if (scene.state.gameOver || scene.ammoRevealPhase || scene.betweenRounds) return;

        const actor = scene.state.players[scene.state.currentTurnIndex];
        scene.updateButtonStates();

        // Reset knife visuals if damage is back to 1
        if (scene.state.shotgun.damage === 1) {
            scene.crossedRevolversSprite.setVisible(false);
            scene.gunSprite.setVisible(true);
            scene.gunSprite.clearTint();
        }

        if (actor.id === "BOT") {
            scene.isProcessing = true;
            scene.updateButtonStates();

            this.showThinkingIndicator(true);

            scene.time.delayedCall(1100 + Math.random() * 700, () => {
                if (scene.ammoRevealPhase || scene.betweenRounds) {
                    this.showThinkingIndicator(false);
                    return;
                }

                const aiAction = decideAIAction(scene.state, scene.rng);
                this.showThinkingIndicator(false);

                if (aiAction) {
                    scene.executeAction(aiAction, "BOT");
                } else {
                    scene.isProcessing = false;
                    scene.updateButtonStates();
                }
            });
        }
    }

    // ==========================================================================
    // THINKING INDICATOR
    // ==========================================================================
    showThinkingIndicator(show) {
        const scale = this.getScale();
        const pc = this.scene.playerContainers[1]; // BOT
        if (show) {
            this.scene.tweens.add({
                targets: pc.avatar,
                scale: scale.AVATAR * 1.08,
                alpha: 0.85,
                duration: 350,
                yoyo: true,
                repeat: -1
            });
        } else {
            this.scene.tweens.killTweensOf(pc.avatar);
            pc.avatar.setScale(scale.AVATAR);
            pc.avatar.setAlpha(1);
        }
    }
}
