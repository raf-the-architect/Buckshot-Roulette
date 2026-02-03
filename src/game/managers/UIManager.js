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

        this.setupButtonFeedback(this.btnShootBot, "btnShootPlayer", finalScale, () => {
             const targetId = this.scene.isMultiplayer 
                 ? (this.scene.selectedTargetId || (this.scene.gameStore?.currentGame?.players.length === 2 ? this.scene.gameStore.currentGame.players.find(p => p.userId !== "YOU" && p.userId !== this.scene.gameStore.myPlayer?.userId)?.userId : null)) 
                 : "BOT";
            
             // Fallback for 2-player MP if explicit selection skipped 
             // (Assuming index 1 is opponent or find checking userId)
             let finalTarget = targetId;
             if (this.scene.isMultiplayer && !finalTarget && this.scene.gameStore?.currentGame?.players.length === 2) {
                 finalTarget = this.scene.gameStore.currentGame.players.find(p => p.userId !== this.scene.gameStore.myPlayer?.userId)?.userId;
             }

             this.scene.onPlayerAction({ type: "SHOOT_PLAYER", playerId: "YOU", targetId: finalTarget });
        });

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
     * Set up button feedback with restricted input
     */
    setupButtonFeedback(button, baseKey, baseScale, callback) {
        button.setInteractive({ useHandCursor: true });

        button.on("pointerdown", () => {
            if (button.alpha < 1) return; // Disabled check
            button.setTexture(baseKey + "Pressed");
            callback();
        });

        button.on("pointerup", () => {
            if (button.alpha < 1) return;
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
        const isPlayerTurn = state.players[state.currentTurnIndex].id === "YOU" || state.players[state.currentTurnIndex].userId === this.scene.gameStore?.myPlayer?.userId; // Handle MP ID check
        const canAct = isPlayerTurn && !isProcessing && !state.gameOver && !ammoRevealPhase && !betweenRounds;

        let canShootPlayer = canAct;
        
        // Multiplayer Target Validation
        if (this.scene.isMultiplayer && canAct) {
             const playerCount = state.players.length;
             if (playerCount > 2 && !this.scene.selectedTargetId) {
                 canShootPlayer = false;
             }
        }

        if (canShootPlayer) {
            this.btnShootBot.setInteractive({ useHandCursor: true });
            this.btnShootBot.setTexture("btnShootPlayerIdle");
            this.btnShootBot.clearTint();
            this.btnShootBot.setAlpha(1);
        } else {
            this.btnShootBot.disableInteractive();
            this.btnShootBot.setTexture("btnShootPlayerDisabled");
            this.btnShootBot.clearTint();
            this.btnShootBot.setAlpha(0.5); // Visual feedback for disabled
        }

        if (canAct) {
            this.btnShootSelf.setInteractive({ useHandCursor: true });
            this.btnShootSelf.setTexture("btnShootSelfIdle");
            this.btnShootSelf.clearTint();
            this.btnShootSelf.setAlpha(1);
        } else {
            this.btnShootSelf.disableInteractive();
            this.btnShootSelf.setTexture("btnShootSelfDisabled");
            this.btnShootSelf.clearTint();
            this.btnShootSelf.setAlpha(0.5);
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
