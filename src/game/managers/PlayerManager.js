/**
 * PlayerManager.js
 * Manages player containers, avatars, hearts, and avatar state updates
 */

import { AVATAR_KEYS, COLORS, FONTS } from "../LayoutConfig.js";

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
     * Set up 1v1 player containers.
     * @param {string} playerName - Local player's display name.
     */
    setup(playerName) {
        this.setupSinglePlayer(playerName);
    }

    setupSinglePlayer(playerName) {
        const layout = this.getLayout();
        const opponentId = this.scene.isMultiplayer ? "OPPONENT" : "BOT";
        const opponentName = this.scene.isMultiplayer ? "Opponent" : "Dealer";
        const localPlayer = this.scene.state?.players?.[0] || null;
        const opponentPlayer = this.scene.state?.players?.[1] || null;

        // Fixed 2-player layout for SP - MUST include position coordinates
        const positions = [
            {
                x: layout.CENTER_X,
                y: layout.BOTTOM_ZONE.y,
                id: "YOU",
                userId: localPlayer?.userId || "YOU",
                name: playerName,
                isLocal: true
            },
            {
                x: layout.CENTER_X,
                y: layout.TOP_ZONE.y,
                id: opponentId,
                userId: opponentPlayer?.userId || opponentId,
                name: opponentName,
                isLocal: false
            }
        ];

        this._createPlayerContainers(positions);
        
        // Initial state check for SP
        if (this.scene.state) {
            this.updateAvatarStates(this.scene.state);
        }
    }

    /**
     * Internal helper to create the visual containers
     */
    _createPlayerContainers(positions) {
        const scale = this.getScale();
        
        positions.forEach((pos, i) => {
            const container = this.scene.add.container(pos.x, pos.y);

            // Avatar Setup
            // In MP, opponent ID is their userId (not "BOT"), so they get PLAYER avatar.
            // In SP, opponent ID is "BOT", so they get BOT avatar.
            const isBot = pos.id === "BOT";
            const initialKey = isBot ? AVATAR_KEYS.BOT : AVATAR_KEYS.PLAYER;
            
            const avatar = this.scene.imageService.createImage(0, 0, initialKey, {
                scale: scale.AVATAR,
                alpha: 1,
                interactive: { useHandCursor: true }
            });

            // Handle selection click
            avatar.on('pointerdown', () => {
                // Pass index and ID. For SP, IDs are "YOU"/"BOT"
                if (this.scene.onPlayerSelected) {
                    this.scene.onPlayerSelected(i, pos.userId || pos.id);
                }
            });

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
                nameBg,
                isLocalPlayer: pos.isLocal
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
    }

    /**
     * Update avatar visuals based on current game state (Single Player)
     */
    updateAvatarStates(state, targetedIndex = null) {
        if (!this.playerContainers || !state?.players) return;
        const scale = this.getScale();

        this.playerContainers.forEach((pc, index) => {
            const player = state.players[index];
            const isCurrentTurn = (index === state.currentTurnIndex);
            const isDead = player.health <= 0;
            const isTargeted = (index === targetedIndex);

            let textureKey;
            // BOT = AI opponent (single-player), uses bot avatar
            // OPPONENT = human opponent (multiplayer), uses player avatar
            // YOU = local player, uses player avatar
            const usesBotAvatar = player.id === "BOT";
            
            if (usesBotAvatar) {
                if (isDead) textureKey = AVATAR_KEYS.BOT_DEAD;
                else if (isTargeted) textureKey = AVATAR_KEYS.BOT_SELECTED;
                else if (isCurrentTurn) textureKey = AVATAR_KEYS.BOT_ACTIVE;
                else textureKey = AVATAR_KEYS.BOT;
            } else {
                // Both "YOU" and "OPPONENT" use player avatars
                if (isDead) textureKey = AVATAR_KEYS.PLAYER_DEAD;
                else if (isTargeted) textureKey = AVATAR_KEYS.PLAYER_SELECTED;
                else if (isCurrentTurn) textureKey = AVATAR_KEYS.PLAYER_ACTIVE;
                else textureKey = AVATAR_KEYS.PLAYER;
            }

            pc.avatar.setTexture(textureKey);

            if (isDead) {
                pc.avatar.setTint(0x555555);
                pc.avatar.setAlpha(0.6);
                pc.glowRing.setAlpha(0);
            } else if (isCurrentTurn) {
                pc.avatar.clearTint();
                pc.avatar.setAlpha(1);
                this.scene.tweens.killTweensOf(pc.glowRing);
                pc.glowRing.setAlpha(0.4);
                this.scene.tweens.add({
                    targets: pc.glowRing, alpha: 0.1, scale: 1.1,
                    duration: 800, yoyo: true, repeat: -1
                });
                this.scene.tweens.add({
                    targets: pc.avatar, scale: scale.AVATAR * 1.05, duration: 400
                });
            } else {
                pc.avatar.clearTint();
                pc.avatar.setAlpha(0.8);
                pc.glowRing.setAlpha(0);
                this.scene.tweens.add({
                    targets: pc.avatar, scale: scale.AVATAR, duration: 400
                });
            }
        });
    }

    /**
     * Render hearts for each player (Single Player)
     */
    renderHearts(state) {
        const maxHealth = 4;
        const heartDisplayWidth = this.getHeartDisplayWidth();
        const heartSpacing = Math.max(18, Math.round(heartDisplayWidth * 1.1));
        const startX = -((maxHealth - 1) * heartSpacing) / 2;

        state.players.forEach((player, i) => {
            const pc = this.playerContainers[i];
            if (!pc) return;
            const isCurrentTurn = i === state.currentTurnIndex;

            if (pc.heartContainer.list.length === 0) {
                for (let h = 0; h < maxHealth; h++) {
                    const heart = this.scene.imageService.createImage(startX + h * heartSpacing, 0, "heartEmpty");
                    const heartScale = heartDisplayWidth / heart.width;
                    heart.setScale(heartScale);
                    pc.heartContainer.add(heart);
                }
            }

            pc.heartContainer.list.forEach((heart, h) => {
                const heartScale = heartDisplayWidth / heart.width;
                heart.x = startX + h * heartSpacing;
                heart.y = 0;
                heart.setScale(heartScale);
                const isFull = h < player.health;
                const targetTexture = isFull ? "heartFull" : "heartEmpty";
                if (heart.texture.key !== targetTexture) heart.setTexture(targetTexture);
                heart.setAlpha(isCurrentTurn ? 1 : 0.5);
            });
        });
    }

    /**
     * Calculate heart icon display width in CSS pixels for crisp retina rendering.
     * Base target is ~18px at 360px viewport width.
     */
    getHeartDisplayWidth() {
        const layout = this.getLayout();
        const scaled = Math.round((layout.WIDTH / 360) * 18);
        return Math.max(16, Math.min(24, scaled));
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

    /**
     * Update opponent name for multiplayer display
     * @param {string} name - Opponent's display name
     */
    updateOpponentName(name) {
        const pc = this.playerContainers[1]; // Opponent is always at index 1
        if (!pc || !pc.nameText) return;
        
        // Only update if different to avoid flickering
        if (pc.nameText.text === name) return;
        
        pc.nameText.setText(name);
        
        // Recalculate background size
        if (pc.nameBg) {
            pc.nameBg.clear();
            pc.nameBg.fillStyle(0x000000, 0.85);
            const bgW = pc.nameText.width + 20;
            const bgH = pc.nameText.height + 6;
            pc.nameBg.fillRoundedRect(-bgW / 2, 40 - bgH / 2, bgW, bgH, 10);
        }
    }

    /**
     * Enable/disable avatar click selection for target picking.
     * @param {boolean} enabled - Selection enabled.
     */
    setSelectionEnabled(enabled) {
        this.playerContainers.forEach((pc, index) => {
            if (!pc?.avatar) return;

            const player = this.scene.state?.players?.[index];
            const isAlive = player ? (player.alive !== false && player.health > 0) : true;
            const shouldEnable = !!enabled && isAlive;
            const isInteractive = !!pc.avatar.input?.enabled;

            if (shouldEnable && !isInteractive) {
                pc.avatar.setInteractive({ useHandCursor: true });
                return;
            }

            if (!shouldEnable && isInteractive) {
                pc.avatar.disableInteractive();
            }
        });
    }

}
