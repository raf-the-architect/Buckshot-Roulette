/**
 * UIManager.js
 * Manages buttons setup, feedback, and state updates
 */

import { COLORS } from "../LayoutConfig.js";

export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.btnShootBot = null;
        this.btnShootSelf = null;
        this.playerItemsContainer = null;
        this.botItemsContainer = null;
        this.actionIndicator = null;
        this.buttonScale = 0.5;
    }

    /**
     * Get current layout dynamically from scene
     */
    getLayout() {
        return this.scene.getLayout();
    }

    /**
     * Set up UI elements
     */
    setup() {
        const layout = this.getLayout();

        // Buttons - Dynamic Bottom Layout
        const margin = 8;
        const gap = 8;
        const availableWidth = layout.WIDTH - (margin * 2);
        const btnWidth = (availableWidth - gap) / 2;
        const btnY = layout.HEIGHT - 32;

        // Shoot Dealer (Left)
        this.btnShootBot = this.scene.add.image(margin + btnWidth / 2, btnY, "btnShootPlayerIdle")
            .setOrigin(0.5, 0.5);

        // Scale buttons proportionally
        const idealHeight = 60;
        const scaleX = btnWidth / this.btnShootBot.width;
        const scaleY = idealHeight / this.btnShootBot.height;
        const finalScale = Math.min(scaleX, scaleY, 0.8);
        this.buttonScale = finalScale;

        this.btnShootBot.setScale(finalScale);

        this.setupButtonFeedback(this.btnShootBot, "btnShootPlayer", finalScale, () =>
            this.scene.onPlayerAction({ type: "SHOOT_PLAYER", playerId: "YOU", targetId: "BOT" }));

        // Shoot Self (Right)
        this.btnShootSelf = this.scene.add.image(margin + btnWidth + gap + btnWidth / 2, btnY, "btnShootSelfIdle")
            .setScale(finalScale)
            .setOrigin(0.5, 0.5);

        this.setupButtonFeedback(this.btnShootSelf, "btnShootSelf", finalScale, () =>
            this.scene.onPlayerAction({ type: "SHOOT_SELF", playerId: "YOU" }));

        // Item containers
        this.playerItemsContainer = this.scene.add.container(layout.CENTER_X, layout.PLAYER_ITEMS_ZONE.y);
        this.botItemsContainer = this.scene.add.container(layout.CENTER_X, layout.BOT_ITEMS_ZONE.y);

        // Action indicator
        this.actionIndicator = this.scene.add.container(layout.CENTER_X, layout.HEIGHT / 2);
    }

    /**
     * Set up button feedback with press/release animations
     */
    setupButtonFeedback(button, baseKey, baseScale, callback) {
        button.setInteractive({ useHandCursor: true });

        button.on("pointerdown", () => {
            button.setTexture(baseKey + "Pressed");
            callback();
        });

        button.on("pointerup", () => {
            button.setTexture(baseKey + "Idle");
        });

        button.on("pointerout", () => {
            button.setTexture(baseKey + "Idle");
        });
    }

    /**
     * Update button states based on game state
     */
    updateButtonStates(state, isProcessing, ammoRevealPhase, betweenRounds) {
        const isPlayerTurn = state.players[state.currentTurnIndex].id === "YOU";
        const canAct = isPlayerTurn && !isProcessing && !state.gameOver && !ammoRevealPhase && !betweenRounds;

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

    /**
     * Get item containers
     */
    getPlayerItemsContainer() {
        return this.playerItemsContainer;
    }

    getBotItemsContainer() {
        return this.botItemsContainer;
    }

    getActionIndicator() {
        return this.actionIndicator;
    }
}
