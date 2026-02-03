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
    /**
     * Unified setup for Single and Multiplayer
     */
    setup(playerNameOrStore) {
        // Determine mode based on argument type
        if (typeof playerNameOrStore === 'string') {
            this.setupSinglePlayer(playerNameOrStore);
        } else {
            this.setupMultiplayer(playerNameOrStore);
        }
    }

    setupSinglePlayer(playerName) {
        const layout = this.getLayout();
        // Fixed 2-player layout for SP
        const positions = [
            { id: "YOU", name: playerName, isLocal: true },
            { id: "BOT", name: "Dealer", isLocal: false }
        ];

        this._createPlayerContainers(positions);
        
        // Initial state check for SP
        if (this.scene.state) {
            this.updateAvatarStates(this.scene.state);
        }
    }

    setupMultiplayer(gameStore) {
        console.log("[PlayerManager] setupMultiplayer called");
        this.gameStore = gameStore;
        this.userIdToIndex = {};
        
        if (!gameStore?.currentGame?.players) {
            console.warn("[PlayerManager] No players in game store yet");
            return;
        }

        const players = gameStore.currentGame.players;
        console.log("[PlayerManager] Setting up players:", players.length);
        
        const positions = [];
        
        // Calculate circular positions
        const layout = this.getLayout();
        console.log("[PlayerManager] Layout dims:", layout.WIDTH, layout.HEIGHT);

        const playerCount = players.length;
        const centerY = layout.HEIGHT / 2;
        const radiusX = layout.WIDTH * 0.35;
        const radiusY = layout.HEIGHT * 0.3;

        players.forEach((player, i) => {
            const isLocal = player.userId === gameStore.myPlayer?.userId;
            
            // Layout calculation logic (simplified for unification)
            let x, y;
            if (playerCount === 2) {
                 // Classic top-bottom layout for 2 players
                 x = layout.CENTER_X;
                 y = isLocal ? layout.BOTTOM_ZONE.y : layout.TOP_ZONE.y;
            } else {
                 // Circular for > 2
                 const angle = ((i / playerCount) * Math.PI * 2) - (Math.PI / 2);
                 x = layout.CENTER_X + Math.cos(angle) * radiusX;
                 y = centerY + Math.sin(angle) * radiusY;
            }

            console.log(`[PlayerManager] Player ${i} (${player.displayName}): x=${x}, y=${y}, isLocal=${isLocal}`);

            positions.push({
                x, y,
                id: player.userId,
                name: player.displayName || 'Player',
                isLocal: isLocal,
                userId: player.userId
            });
            
            this.userIdToIndex[player.userId] = i;
        });

        this._createPlayerContainers(positions);
        this.renderHeartsMultiplayer(players);
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
            const isDealer = pos.id === "BOT";
            const initialKey = isDealer ? AVATAR_KEYS.BOT : AVATAR_KEYS.PLAYER;
            
            const avatar = this.scene.add.image(0, 0, initialKey)
                .setOrigin(0.5, 0.5)
                .setScale(scale.AVATAR)
                .setAlpha(1)
                .setInteractive({ useHandCursor: true });

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
     * Update player visuals from Firebase state
     * @param {Array} players - Player array from Firebase
     * @param {number} currentTurn - Current turn index
     */
    updateFromFirebase(players, currentTurn, targetedIndex = null) {
        if (!players || !this.playerContainers) return;
        const scale = this.getScale();

        players.forEach((player, index) => {
            const pc = this.playerContainers[index];
            if (!pc) return;

            const isCurrentTurn = (index === currentTurn);
            const isDead = !player.isAlive;
            const isTargeted = (index === targetedIndex);

            // Update texture based on state
            // Update texture based on state
            const isDealer = pc.id === "BOT";
            let textureKey;

            if (isDealer) {
                if (isDead) textureKey = AVATAR_KEYS.BOT_DEAD;
                else if (isTargeted) textureKey = AVATAR_KEYS.BOT_SELECTED; 
                else if (isCurrentTurn) textureKey = AVATAR_KEYS.BOT_ACTIVE;
                else textureKey = AVATAR_KEYS.BOT;
            } else {
                // Player (Local or Remote)
                if (isDead) textureKey = AVATAR_KEYS.PLAYER_DEAD;
                else if (isTargeted) textureKey = AVATAR_KEYS.PLAYER_SELECTED;
                else if (isCurrentTurn) textureKey = AVATAR_KEYS.PLAYER_ACTIVE;
                else textureKey = AVATAR_KEYS.PLAYER;
            }

            pc.avatar.setTexture(textureKey);

            // Visual effects
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
                    targets: pc.glowRing,
                    alpha: 0.1,
                    scale: 1.1,
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });
            } else if (isTargeted) {
                // Targeted state (Static glow or highlight)
                pc.avatar.clearTint();
                pc.avatar.setAlpha(1);
                pc.glowRing.setAlpha(0.6); // Steady glow for selected
                pc.glowRing.setScale(1.1);
            } else {
                pc.avatar.clearTint();
                pc.avatar.setAlpha(0.8);
                pc.glowRing.setAlpha(0);
            }
        });

        // Update hearts
        this.renderHeartsMultiplayer(players);
    }

    /**
     * Render hearts for multiplayer
     * @param {Array} players - Player array from Firebase
     */
    renderHeartsMultiplayer(players) {
        const scale = this.getScale();
        const maxHealth = 6; // MP can have higher health
        const heartSpacing = 16;

        players.forEach((player, i) => {
            const pc = this.playerContainers[i];
            if (!pc) return;

            const numHearts = player.maxHealth || 4;
            const startX = -((numHearts - 1) * heartSpacing) / 2;

            // Create hearts if needed
            if (pc.heartContainer.list.length !== numHearts) {
                pc.heartContainer.removeAll(true);
                for (let h = 0; h < numHearts; h++) {
                    const heart = this.scene.add.image(startX + h * heartSpacing, 0, 'heartEmpty')
                        .setScale(scale.HEART * 0.8)
                        .setOrigin(0.5, 0.5);
                    pc.heartContainer.add(heart);
                }
            }

            // Update heart states
            pc.heartContainer.list.forEach((heart, h) => {
                const isFull = h < player.health;
                heart.setTexture(isFull ? 'heartFull' : 'heartEmpty');
                heart.setAlpha(isFull ? 1 : 0.3);
            });
        });
    }

    /**
     * Get container by Firebase userId
     * @param {string} userId - Firebase user ID
     * @returns {Object|null} Player container
     */
    getContainerByUserId(userId) {
        const index = this.userIdToIndex?.[userId];
        if (index !== undefined) {
            return this.playerContainers[index]?.container;
        }
        return null;
    }
}

