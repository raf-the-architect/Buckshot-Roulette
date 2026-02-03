/**
 * PlayerManager.js
 * Manages player containers, avatars, hearts, and avatar state updates
 */

import { AVATAR_KEYS, COLORS, FONTS, SCALE } from "../LayoutConfig.js";

export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.playerContainers = [];
    }

    /**
     * Get current layout dynamically from scene
     */
    getLayout() {
        return this.scene.getLayout();
    }

    /**
     * Get current scale dynamically from scene
     */
    getScale() {
        return this.scene.getScale();
    }

    /**
     * Set up player containers with avatars, names, and hearts
     */
    setup(playerName) {
        const layout = this.getLayout();
        const scale = this.getScale();

        const positions = [
            { x: layout.CENTER_X, y: layout.BOTTOM_ZONE.y, id: "YOU", name: playerName },
            { x: layout.CENTER_X, y: layout.TOP_ZONE.y, id: "BOT", name: "Dealer" }
        ];

        positions.forEach((pos, i) => {
            const container = this.scene.add.container(pos.x, pos.y);

            // Avatar Setup
            const initialKey = pos.id === "BOT" ? AVATAR_KEYS.BOT : AVATAR_KEYS.PLAYER;
            const avatar = this.scene.add.image(0, 0, initialKey)
                .setOrigin(0.5, 0.5)
                .setScale(scale.AVATAR)
                .setAlpha(1);

            // Glow Ring (Active State)
            const glowRing = this.scene.add.circle(0, 0, 55, 0x4a90d9, 0);

            // Name Text & Background
            const nameY = 40;
            const heartY = 60;

            const nameText = this.scene.add.text(0, nameY, pos.name, {
                ...FONTS.BODY,
                fontSize: "12px",
                fontStyle: "bold",
                color: COLORS.TEXT_PRIMARY
            }).setOrigin(0.5).setDepth(2);

            // Graphics for rounded black BG
            const nameBg = this.scene.add.graphics();
            nameBg.fillStyle(0x000000, 0.85);

            // Dynamic padding for the name background
            const bgW = nameText.width + 20;
            const bgH = nameText.height + 6;
            nameBg.fillRoundedRect(-bgW / 2, nameY - bgH / 2, bgW, bgH, 10);
            nameBg.setDepth(1);

            const heartContainer = this.scene.add.container(0, heartY);
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
            this.scene.tweens.add({
                targets: container,
                y: pos.y + (i === 0 ? 3 : -3),
                duration: 2500 + Math.random() * 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });

        // Initial state check
        this.updateAvatarStates(this.scene.state);
    }

    /**
     * Update avatar visuals based on current game state
     */
    updateAvatarStates(state, targetedIndex = null) {
        if (!this.playerContainers) return;
        const scale = this.getScale();

        this.playerContainers.forEach((pc, index) => {
            const player = state.players[index];
            const isCurrentTurn = (index === state.currentTurnIndex);
            const isDead = player.health <= 0;
            const isTargeted = (index === targetedIndex);

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
                this.scene.tweens.killTweensOf(pc.glowRing);
                pc.glowRing.setAlpha(0.4);
                this.scene.tweens.add({
                    targets: pc.glowRing,
                    alpha: 0.1,
                    scale: 1.1,
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });

                // Slight scale up for active avatar
                this.scene.tweens.add({
                    targets: pc.avatar,
                    scale: scale.AVATAR * 1.05,
                    duration: 400
                });
            } else {
                // Idle
                pc.avatar.clearTint();
                pc.avatar.setAlpha(0.8);
                pc.glowRing.setAlpha(0);

                this.scene.tweens.add({
                    targets: pc.avatar,
                    scale: scale.AVATAR,
                    duration: 400
                });
            }
        });
    }

    /**
     * Render hearts for each player
     */
    renderHearts(state) {
        const scale = this.getScale();
        const maxHealth = 4;
        const heartSpacing = 20;
        const startX = -((maxHealth - 1) * heartSpacing) / 2;

        state.players.forEach((player, i) => {
            const pc = this.playerContainers[i];
            const isCurrentTurn = i === state.currentTurnIndex;

            if (pc.heartContainer.list.length === 0) {
                for (let h = 0; h < maxHealth; h++) {
                    const heart = this.scene.add.image(startX + h * heartSpacing, 0, "heartEmpty")
                        .setScale(scale.HEART)
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
    }

    /**
     * Get player container by index
     */
    getContainer(index) {
        return this.playerContainers[index];
    }

    /**
     * Get all player containers
     */
    getContainers() {
        return this.playerContainers;
    }
}
