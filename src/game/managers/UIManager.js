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
        const margin = 8;
        const gap = 8;
        const availableWidth = layout.WIDTH - (margin * 2);
        const bottomPadding = Math.max(56, Math.round(layout.HEIGHT * 0.09));
        const btnY = layout.HEIGHT - bottomPadding;

        if (this.scene.isMultiplayer) {
            const btnWidth = availableWidth;
            this.btnShootBot = this.scene.imageService.createImage(layout.CENTER_X, btnY, "btnShootPlayerIdle");

            const idealHeight = 60;
            const scaleX = btnWidth / this.btnShootBot.width;
            const scaleY = idealHeight / this.btnShootBot.height;
            const finalScale = Math.min(scaleX, scaleY, 1.1);
            this.buttonScale = finalScale;
            this.btnShootBot.setScale(finalScale);

            this.setupButtonFeedback(this.btnShootBot, "btnShootPlayer", finalScale, () => {
                const selectedTarget = this.scene.selectedTargetId;
                const myUserId = this.scene.getMyUserId?.();
                if (!selectedTarget || !myUserId) return;

                const isSelfTarget = selectedTarget === myUserId;
                this.scene.onPlayerAction({
                    type: isSelfTarget ? "SHOOT_SELF" : "SHOOT_PLAYER",
                    playerId: "YOU",
                    targetId: selectedTarget
                });
            });

            this.btnShootSelf = null;
        } else {
            const btnWidth = (availableWidth - gap) / 2;

            // Shoot Dealer (Left)
            this.btnShootBot = this.scene.imageService.createImage(margin + btnWidth / 2, btnY, "btnShootPlayerIdle");

            // Scale buttons proportionally
            const idealHeight = 60;
            const scaleX = btnWidth / this.btnShootBot.width;
            const scaleY = idealHeight / this.btnShootBot.height;
            const finalScale = Math.min(scaleX, scaleY, 0.8);
            this.buttonScale = finalScale;

            this.btnShootBot.setScale(finalScale);

            this.setupButtonFeedback(this.btnShootBot, "btnShootPlayer", finalScale, () => {
                this.scene.onPlayerAction({ type: "SHOOT_PLAYER", playerId: "YOU", targetId: "BOT" });
            });

            // Shoot Self (Right)
            this.btnShootSelf = this.scene.imageService.createImage(
                margin + btnWidth + gap + btnWidth / 2,
                btnY,
                "btnShootSelfIdle",
                { scale: finalScale }
            );

            this.setupButtonFeedback(this.btnShootSelf, "btnShootSelf", finalScale, () =>
                this.scene.onPlayerAction({ type: "SHOOT_SELF", playerId: "YOU" }));
        }

        // Item containers (shifted slightly downward in multiplayer for better visibility).
        const topItemsY = this.scene.isMultiplayer
            ? layout.BOT_ITEMS_ZONE.y + Math.round(layout.HEIGHT * 0.055)
            : layout.BOT_ITEMS_ZONE.y;
        const bottomItemsY = this.scene.isMultiplayer
            ? layout.PLAYER_ITEMS_ZONE.y + Math.round(layout.HEIGHT * 0.05)
            : layout.PLAYER_ITEMS_ZONE.y;

        this.playerItemsContainer = this.scene.add.container(layout.CENTER_X, bottomItemsY);
        this.botItemsContainer = this.scene.add.container(layout.CENTER_X, topItemsY);

        // Action indicator
        this.actionIndicator = this.scene.add.container(layout.CENTER_X, layout.HEIGHT / 2);
    }

    /**
     * Resolve default opponent target in 1v1 multiplayer
     */
    resolveDefaultTargetId() {
        const players = this.scene.gameStore?.currentGame?.players;
        const myUserId = this.scene.getMyUserId?.();
        if (!players?.length || !myUserId) return null;
        return players.find(p => p.userId !== myUserId)?.userId || null;
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
        const currentPlayer = state.players[state.currentTurnIndex];
        if (!currentPlayer) {
            this.btnShootBot?.disableInteractive();
            this.btnShootSelf?.disableInteractive();
            this.btnShootBot?.setTexture("btnShootPlayerDisabled");
            this.btnShootBot?.setAlpha(0.5);
            this.btnShootSelf?.setTexture("btnShootSelfDisabled");
            this.btnShootSelf?.setAlpha(0.5);
            return;
        }

        const isPlayerTurn = this.scene.isMultiplayer
            ? !!this.scene.gameStore?.isMyTurn
            : currentPlayer.id === "YOU";
        const startSyncReady = this.scene.isMultiplayer
            ? !!this.scene.gameStore?.startGateOpen
            : true;
        const canAct = isPlayerTurn && startSyncReady && !isProcessing && !state.gameOver && !ammoRevealPhase && !betweenRounds;

        const hasSelectedTarget = !!this.scene.selectedTargetId;
        const selectedTarget = state.players.find(p =>
            (p.userId === this.scene.selectedTargetId || p.id === this.scene.selectedTargetId) && p.alive
        );
        const canShootPlayer = this.scene.isMultiplayer
            ? (canAct && hasSelectedTarget && !!selectedTarget)
            : canAct;

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

        if (this.scene.isMultiplayer) return;

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
