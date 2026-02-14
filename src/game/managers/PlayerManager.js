/**
 * PlayerManager.js
 * Manages player containers, avatars, hearts, and avatar state updates.
 */

import { AVATAR_KEYS, COLORS, FONTS } from "../LayoutConfig.js";

const CLOCK_HOURS_BY_COUNT = Object.freeze({
    // Clockwise dispatch order used for host -> join order mapping.
    2: [12, 6],
    3: [12, 3, 6],
    4: [12, 3, 6, 9],
    5: [12, 2, 4, 6, 9],
    6: [12, 2, 4, 6, 8, 10],
    7: [12, 2, 3, 4, 6, 8, 10],
    8: [12, 2, 3, 4, 6, 8, 9, 10]
});

export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.playerContainers = [];
        this.lastClockLayoutKey = null;
        this.offlineSinceByUserId = new Map();
    }

    /**
     * Get current layout dynamically from scene.
     */
    getLayout() {
        return this.scene.getLayout();
    }

    /**
     * Get current scale dynamically from scene.
     */
    getScale() {
        return this.scene.getScale();
    }

    /**
     * Set up player containers for either single-player or multiplayer.
     * @param {string} playerName - Local player's display name.
     */
    setup(playerName) {
        if (this.scene.isMultiplayer) {
            this.setupMultiplayer(playerName);
            return;
        }
        this.setupSinglePlayer(playerName);
    }

    /**
     * Set up fixed 1v1 layout used by offline mode.
     * @param {string} playerName - Local player's display name.
     */
    setupSinglePlayer(playerName) {
        const layout = this.getLayout();
        const localPlayer = this.scene.state?.players?.[0] || null;
        const opponentPlayer = this.scene.state?.players?.[1] || null;

        const positions = [
            {
                x: layout.CENTER_X,
                y: layout.BOTTOM_ZONE.y + this.getLocalPlayerYOffset(),
                id: "YOU",
                userId: localPlayer?.userId || "YOU",
                name: playerName,
                isLocal: true,
                clockHour: 6
            },
            {
                x: layout.CENTER_X,
                y: layout.TOP_ZONE.y,
                id: "BOT",
                userId: opponentPlayer?.userId || "BOT",
                name: "Dealer",
                isLocal: false,
                clockHour: 12
            }
        ];

        this._createPlayerContainers(positions);

        if (this.scene.state) {
            this.updateAvatarStates(this.scene.state);
        }
    }

    /**
     * Set up multiplayer avatars in analog-clock layout for 2..8 players.
     * Player ordering follows authoritative room/game order (host, then join order).
     * @param {string} fallbackLocalName - Local fallback display name.
     */
    setupMultiplayer(fallbackLocalName) {
        const players = this.scene.state?.players || [];
        if (players.length < 2) {
            this.setupSinglePlayer(fallbackLocalName);
            return;
        }

        const limitedPlayers = players.slice(0, 8);
        const playerCount = limitedPlayers.length;
        const metrics = this.getClockMetrics();
        const myUserId = this.scene.getMyUserId?.();
        const localIndex = this.resolveLocalPlayerIndex(limitedPlayers, myUserId);
        const hours = this.getRotatedClockHoursForView(playerCount, localIndex);

        const positions = limitedPlayers.map((player, index) => {
            const hour = hours[index] || 12;
            const basePos = this.hourToPosition(hour, metrics);
            const isLocal = index === localIndex || (!!myUserId && player.userId === myUserId);
            const clampedPos = this.clampMultiplayerPosition(basePos, playerCount, isLocal);
            const displayName = isLocal
                ? "YOU"
                : (player.displayName || `Player ${index + 1}`);

            return {
                x: clampedPos.x,
                y: clampedPos.y,
                id: player.id || (player.userId || `PLAYER_${index}`),
                userId: player.userId || player.id || `PLAYER_${index}`,
                name: displayName,
                isLocal,
                clockHour: hour
            };
        });

        this._createPlayerContainers(positions);

        if (this.scene.state) {
            this.updateAvatarStates(this.scene.state);
        }
    }

    /**
     * Resolve ordered clock hours for requested player count.
     * @param {number} count - Number of players.
     * @returns {number[]}
     */
    getClockHoursForCount(count) {
        const normalized = Math.max(2, Math.min(8, count || 2));
        return CLOCK_HOURS_BY_COUNT[normalized] || CLOCK_HOURS_BY_COUNT[2];
    }

    /**
     * Rotate hour anchors so local player is always at 6 o'clock while preserving clockwise player order.
     * @param {number} count - Player count.
     * @param {number} localIndex - Local player's index in canonical order.
     * @returns {number[]}
     */
    getRotatedClockHoursForView(count, localIndex) {
        const base = this.getClockHoursForCount(count);
        const normalizedCount = base.length;
        if (normalizedCount === 0) return base;

        const safeLocalIndex = Phaser.Math.Clamp(Number(localIndex) || 0, 0, normalizedCount - 1);
        const sixIdx = base.indexOf(6);
        const anchorAtSixIdx = sixIdx >= 0 ? sixIdx : 0;

        return base.map((_hour, playerIdx) => {
            const src = (anchorAtSixIdx + (playerIdx - safeLocalIndex) + normalizedCount) % normalizedCount;
            return base[src];
        });
    }

    /**
     * Compute clock ring metrics from responsive layout.
     * @returns {{centerX: number, centerY: number, radiusX: number, radiusY: number, bottomY: number}}
     */
    getClockMetrics() {
        const layout = this.getLayout();
        const topY = Math.round(Phaser.Math.Clamp(layout.HEIGHT * 0.075, 40, 64));
        const bottomY = Math.round(Phaser.Math.Clamp(layout.HEIGHT * 0.79, 470, layout.HEIGHT - 118));
        const centerY = Math.round((topY + bottomY) / 2);
        const radiusX = Phaser.Math.Clamp(layout.WIDTH * 0.41, 120, 220);
        const radiusY = Math.max(160, Math.round((bottomY - topY) / 2));

        return {
            centerX: layout.CENTER_X,
            centerY,
            radiusX,
            radiusY,
            bottomY
        };
    }

    /**
     * Convert a clock hour marker to scene coordinates.
     * @param {number} hour - Clock hour (1..12).
     * @param {object} metrics - Ring metrics from `getClockMetrics`.
     * @returns {{x:number, y:number}}
     */
    hourToPosition(hour, metrics) {
        const normalizedHour = ((Number(hour) || 12) % 12) || 12;
        const angleDeg = normalizedHour * 30;
        const angleRad = Phaser.Math.DegToRad(angleDeg);
        return {
            x: metrics.centerX + (metrics.radiusX * Math.sin(angleRad)),
            y: metrics.centerY - (metrics.radiusY * Math.cos(angleRad))
        };
    }

    /**
     * Avatar size multiplier based on total player count.
     * @param {number} count - Player count.
     * @returns {number}
     */
    getAvatarScaleMultiplier(count) {
        if (count <= 2) return 1;
        if (count === 3) return 0.94;
        if (count === 4) return 0.88;
        if (count === 5) return 0.8;
        if (count === 6) return 0.74;
        if (count === 7) return 0.69;
        return 0.65;
    }

    /**
     * Resolve local player index robustly from user id, scene state, or fallback cache.
     * @param {Array<object>} players - Ordered players.
     * @param {string | null} myUserId - Local user id when available.
     * @returns {number}
     */
    resolveLocalPlayerIndex(players, myUserId = null) {
        const count = Array.isArray(players) ? players.length : 0;
        if (count <= 0) return 0;

        if (myUserId) {
            const userMatchIndex = players.findIndex(
                player => player?.userId === myUserId || player?.id === myUserId
            );
            if (userMatchIndex >= 0) return userMatchIndex;
        }

        const stateLocalIndex = Number(this.scene.getLocalPlayerIndex?.());
        if (Number.isFinite(stateLocalIndex) && stateLocalIndex >= 0 && stateLocalIndex < count) {
            return stateLocalIndex;
        }

        const explicitLocalIndex = players.findIndex(
            player => player?.isLocal === true || player?.isLocalPlayer === true
        );
        if (explicitLocalIndex >= 0) return explicitLocalIndex;

        return 0;
    }

    /**
     * Full player cluster scale (avatar + hearts + items + badges).
     * @returns {number}
     */
    getPlayerGroupScale() {
        return this.scene.isMultiplayer ? 1.2 : 1;
    }

    /**
     * Vertical offset applied to local player cluster.
     * @returns {number}
     */
    getLocalPlayerYOffset() {
        return -20;
    }

    /**
     * Resolve source image dimensions for a texture key.
     * @param {string} textureKey - Phaser texture key.
     * @param {{width:number,height:number}} fallback - Default dimensions.
     * @returns {{width:number,height:number}}
     */
    getTextureSize(textureKey, fallback) {
        const texture = this.scene.textures?.get?.(textureKey);
        const source = texture?.getSourceImage?.();
        return {
            width: Number(source?.width) || fallback.width,
            height: Number(source?.height) || fallback.height
        };
    }

    /**
     * Compute safe viewport paddings for one player cluster.
     * @param {number} playerCount - Current player count.
     * @param {number} y - Candidate Y position (after local offset).
     * @param {boolean} isLocal - Whether this is local player.
     * @returns {{left:number,right:number,top:number,bottom:number}}
     */
    getClusterViewportPadding(playerCount, y, isLocal) {
        const layout = this.getLayout();
        const scale = this.getScale();
        const avatarScale = scale.AVATAR * this.getAvatarScaleMultiplier(playerCount);
        const groupScale = this.getPlayerGroupScale();
        const avatarSize = this.getTextureSize(AVATAR_KEYS.PLAYER, { width: 256, height: 256 });
        const handcuffSize = this.getTextureSize("itemHandcuffs", { width: 128, height: 128 });

        const avatarHalfW = (avatarSize.width * avatarScale) / 2;
        const avatarHalfH = (avatarSize.height * avatarScale) / 2;
        const handcuffScale = Math.max(0.1, avatarScale * 0.45);
        const handcuffHalfH = (handcuffSize.height * handcuffScale) / 2;

        // ItemRenderer uses max 6 columns with spacing 28 and max icon size 29.
        const maxItemColumns = 6;
        const itemSpacing = 28;
        const itemMaxDim = 29;
        const itemRowWidth = ((maxItemColumns - 1) * itemSpacing) + itemMaxDim;
        const itemHalfH = itemMaxDim / 2;

        const heartDisplayWidth = this.getHeartDisplayWidth(playerCount);
        const heartHalfH = heartDisplayWidth / 2;

        const nameY = Math.round(38 * (avatarScale / Math.max(scale.AVATAR, 0.001)));
        const nameHalfH = 9;

        const isTopHalf = y <= layout.HEIGHT * 0.47;
        const heartY = isLocal ? 58 : (isTopHalf ? 58 : -58);
        const itemsY = isTopHalf ? 68 : -68;

        // Horizontal clamp is based on avatar/hearts footprint.
        // Side item rows are shifted inward separately so avatars can stay near edges.
        const leftRightExtent = Math.max(avatarHalfW, 28);
        const topExtent = Math.max(
            avatarHalfH,
            -Math.min(heartY - heartHalfH, 0),
            -Math.min(itemsY - itemHalfH, 0),
            -Math.min(nameY - nameHalfH, 0),
            42 + handcuffHalfH,
            30
        );
        const bottomExtent = Math.max(
            avatarHalfH,
            Math.max(heartY + heartHalfH, 0),
            Math.max(itemsY + itemHalfH, 0),
            Math.max(nameY + nameHalfH, 0)
        );

        const edgePadding = 10;
        return {
            left: (leftRightExtent * groupScale) + edgePadding,
            right: (leftRightExtent * groupScale) + edgePadding,
            top: (topExtent * groupScale) + edgePadding,
            bottom: (bottomExtent * groupScale) + edgePadding
        };
    }

    /**
     * Clamp a multiplayer clock position to keep full player cluster visible.
     * @param {{x:number,y:number}} basePos - Ring position before local offset.
     * @param {number} playerCount - Current player count.
     * @param {boolean} isLocal - Whether local player.
     * @returns {{x:number,y:number}}
     */
    clampMultiplayerPosition(basePos, playerCount, isLocal) {
        const layout = this.getLayout();
        let x = basePos.x;
        let y = basePos.y + (isLocal ? this.getLocalPlayerYOffset() : 0);

        // Y-dependent top/bottom accessory layout may flip around the center threshold.
        for (let i = 0; i < 2; i++) {
            const padding = this.getClusterViewportPadding(playerCount, y, isLocal);
            x = Phaser.Math.Clamp(x, padding.left, layout.WIDTH - padding.right);
            y = Phaser.Math.Clamp(y, padding.top, layout.HEIGHT - padding.bottom);
        }

        return { x, y };
    }

    /**
     * Shift side item rows inward to avoid viewport clipping while keeping avatars near edges.
     * @param {number} playerX - Player container x.
     * @returns {number}
     */
    getItemsHorizontalOffset(playerX) {
        const centerX = this.getLayout().CENTER_X;
        const delta = playerX - centerX;
        if (Math.abs(delta) < 26) return 0;
        const direction = Math.sign(delta);
        return -direction * 46;
    }

    /**
     * Shift side heart rows inward to keep them visible while avatars stay near edges.
     * @param {number} playerX - Player container x.
     * @returns {number}
     */
    getHeartsHorizontalOffset(playerX) {
        const centerX = this.getLayout().CENTER_X;
        const delta = playerX - centerX;
        if (Math.abs(delta) < 26) return 0;
        const direction = Math.sign(delta);
        return -direction * 14;
    }

    /**
     * Internal helper to create visual containers.
     * @param {Array<object>} positions - Precomputed player positions.
     */
    _createPlayerContainers(positions) {
        const scale = this.getScale();
        const layout = this.getLayout();
        const playerCount = Math.max(2, positions.length);
        const avatarScale = scale.AVATAR * this.getAvatarScaleMultiplier(playerCount);
        const nameFontPx = playerCount >= 6 ? 10 : 12;
        const nameY = Math.round(38 * (avatarScale / Math.max(scale.AVATAR, 0.001)));
        const glowRadius = Math.max(32, Math.round(52 * (avatarScale / Math.max(scale.AVATAR, 0.001))));
        const playerGroupScale = this.getPlayerGroupScale();

        this.playerContainers.forEach((pc) => pc?.container?.destroy(true));
        this.playerContainers = [];
        this.lastClockLayoutKey = `${layout.WIDTH}x${layout.HEIGHT}:${playerCount}`;

        positions.forEach((pos, i) => {
            const container = this.scene.add.container(pos.x, pos.y);

            const usesBotAvatar = pos.id === "BOT";
            const initialKey = usesBotAvatar ? AVATAR_KEYS.BOT : AVATAR_KEYS.PLAYER;

            const avatar = this.scene.imageService.createImage(0, 0, initialKey, {
                scale: avatarScale,
                alpha: 1,
                interactive: { useHandCursor: true }
            });

            avatar.setFlipX(pos.x > this.getLayout().CENTER_X + 2);

            avatar.on("pointerdown", () => {
                if (this.scene.onPlayerSelected) {
                    this.scene.onPlayerSelected(i, pos.userId || pos.id);
                }
            });

            const glowRing = this.scene.add.circle(0, 0, glowRadius, 0x4a90d9, 0);

            const nameText = this.scene.add.text(0, nameY, pos.name, {
                ...FONTS.BODY,
                fontSize: `${nameFontPx}px`,
                fontStyle: "bold",
                color: COLORS.TEXT_PRIMARY
            }).setOrigin(0.5).setDepth(2);

            const nameBg = this.scene.add.graphics();
            nameBg.fillStyle(0x000000, 0.85);
            const bgW = nameText.width + 20;
            const bgH = nameText.height + 6;
            nameBg.fillRoundedRect(-bgW / 2, nameY - bgH / 2, bgW, bgH, 10);
            nameBg.setDepth(1);

            const isTopHalf = pos.y <= layout.HEIGHT * 0.47;
            const heartY = pos.isLocal ? 58 : (isTopHalf ? 58 : -58);
            const itemsY = isTopHalf ? 68 : -68;
            const heartsX = this.getHeartsHorizontalOffset(pos.x);
            const itemsX = this.getItemsHorizontalOffset(pos.x);
            const heartContainer = this.scene.add.container(heartsX, heartY);
            const itemsContainer = this.scene.add.container(itemsX, itemsY);
            const handcuffContainer = this.scene.add.container(0, -42);
            const handcuffIcon = this.scene.imageService.createImage(0, 0, "itemHandcuffs", {
                scale: Math.max(0.1, avatarScale * 0.45),
                alpha: 0.95
            });
            const handcuffBadge = this.scene.add.circle(9, -8, 7, 0xe53935, 0.95).setVisible(false);
            const handcuffBadgeText = this.scene.add.text(9, -8, "1", {
                fontFamily: "Arial, sans-serif",
                fontSize: "9px",
                fontStyle: "bold",
                color: "#ffffff"
            }).setOrigin(0.5).setVisible(false);
            handcuffContainer.add([handcuffIcon, handcuffBadge, handcuffBadgeText]);
            handcuffContainer.setVisible(false);
            const afkBadge = this.scene.add.circle(24, -24, 5, 0xe53935, 1)
                .setStrokeStyle(1, 0xffffff, 0.9)
                .setVisible(false)
                .setDepth(3);

            container.add([glowRing, avatar, nameBg, nameText, heartContainer, itemsContainer, handcuffContainer, afkBadge]);

            this.playerContainers[i] = {
                container,
                avatar,
                heartContainer,
                glowRing,
                id: pos.id,
                userId: pos.userId,
                nameText,
                nameBg,
                itemsContainer,
                handcuffContainer,
                handcuffIcon,
                handcuffBadge,
                handcuffBadgeText,
                afkBadge,
                isLocalPlayer: pos.isLocal,
                clockHour: pos.clockHour,
                baseAvatarScale: avatarScale
            };

            container.setDepth(10);
            container.setScale(playerGroupScale);

            this.scene.tweens.add({
                targets: container,
                y: pos.y + (pos.isLocal ? 1 : -1),
                duration: 2500 + Math.random() * 500,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });
        });
    }

    /**
     * Reflow multiplayer avatar positions when viewport changes.
     */
    reflowMultiplayerClockPositions() {
        if (!this.scene.isMultiplayer || this.playerContainers.length < 2) return;
        const statePlayers = this.scene.state?.players || [];
        const myUserId = this.scene.getMyUserId?.() || null;
        const localIndex = this.resolveLocalPlayerIndex(
            statePlayers.length ? statePlayers : this.playerContainers,
            myUserId
        );
        const layout = this.getLayout();
        const layoutKey = `${layout.WIDTH}x${layout.HEIGHT}:${this.playerContainers.length}:${localIndex}`;
        if (this.lastClockLayoutKey === layoutKey) return;
        this.lastClockLayoutKey = layoutKey;

        const hours = this.getRotatedClockHoursForView(this.playerContainers.length, localIndex);
        const metrics = this.getClockMetrics();
        const playerGroupScale = this.getPlayerGroupScale();

        this.playerContainers.forEach((pc, index) => {
            const hour = hours[index] || pc.clockHour || 12;
            const nextPos = this.hourToPosition(hour, metrics);
            const isLocal = index === localIndex || (!!myUserId && pc.userId === myUserId);
            const clampedPos = this.clampMultiplayerPosition(nextPos, this.playerContainers.length, isLocal);
            const nextY = clampedPos.y;

            pc.clockHour = hour;
            pc.isLocalPlayer = isLocal;
            pc.container.x = clampedPos.x;
            pc.container.y = nextY;
            pc.container.setScale(playerGroupScale);
            pc.avatar.setFlipX(clampedPos.x > metrics.centerX + 2);
            if (pc.heartContainer) {
                pc.heartContainer.x = this.getHeartsHorizontalOffset(clampedPos.x);
            }
            if (pc.itemsContainer) {
                pc.itemsContainer.x = this.getItemsHorizontalOffset(clampedPos.x);
            }

            this.scene.tweens.killTweensOf(pc.container);
            this.scene.tweens.add({
                targets: pc.container,
                y: nextY + (isLocal ? 1 : -1),
                duration: 2500 + Math.random() * 500,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });
        });
    }

    /**
     * Update avatar visuals based on current game state.
     * @param {object} state - Current scene state.
     * @param {number | null} targetedIndex - Selected target index.
     */
    updateAvatarStates(state, targetedIndex = null) {
        if (!this.playerContainers || !state?.players) return;

        this.reflowMultiplayerClockPositions();

        this.playerContainers.forEach((pc, index) => {
            const player = state.players[index];
            if (!player) return;

            const isCurrentTurn = index === state.currentTurnIndex;
            const isDead = player.health <= 0 || player.alive === false;
            const isTargeted = index === targetedIndex;
            const usesBotAvatar = player.id === "BOT";
            const baseScale = pc.baseAvatarScale || this.getScale().AVATAR;

            let textureKey;
            if (usesBotAvatar) {
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
            this.scene.tweens.killTweensOf(pc.avatar);
            this.scene.tweens.killTweensOf(pc.glowRing);

            if (isDead) {
                pc.avatar.setTint(0x555555);
                pc.avatar.setAlpha(0.6);
                pc.avatar.setScale(baseScale);
                pc.glowRing.setAlpha(0);
            } else if (isCurrentTurn) {
                pc.avatar.clearTint();
                pc.avatar.setAlpha(1);
                pc.glowRing.setAlpha(0.4);

                this.scene.tweens.add({
                    targets: pc.glowRing,
                    alpha: 0.1,
                    scale: 1.1,
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });
                this.scene.tweens.add({
                    targets: pc.avatar,
                    scale: baseScale * 1.05,
                    duration: 400
                });
            } else {
                pc.avatar.clearTint();
                pc.avatar.setAlpha(0.8);
                pc.glowRing.setAlpha(0);
                pc.avatar.setScale(baseScale);
            }
        });

        this.updateHandcuffIndicators(state);
        this.updateAfkBadges(state);
    }

    /**
     * Render hearts for each player.
     * @param {object} state - Current scene state.
     */
    renderHearts(state) {
        state.players.forEach((player, i) => {
            const pc = this.playerContainers[i];
            if (!pc) return;

            if (player.alive === false || player.health <= 0) {
                pc.heartContainer.removeAll(true);
                pc.heartContainer.setVisible(false);
                return;
            }
            pc.heartContainer.setVisible(true);

            const maxHealth = player.maxHealth || 4;
            const heartDisplayWidth = this.getHeartDisplayWidth(this.playerContainers.length);
            const heartSpacing = Math.max(11, Math.round(heartDisplayWidth * 0.95));
            const startX = -((maxHealth - 1) * heartSpacing) / 2;
            const isCurrentTurn = i === state.currentTurnIndex;

            if (pc.heartContainer.list.length !== maxHealth) {
                pc.heartContainer.removeAll(true);
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

                if (!isFull) {
                    heart.setAlpha(1);
                } else {
                    heart.setAlpha(isCurrentTurn ? 1 : 0.5);
                }
            });
        });
    }

    /**
     * Calculate heart icon size in CSS pixels.
     * @param {number} playerCount - Current player count.
     * @returns {number}
     */
    getHeartDisplayWidth(playerCount = 2) {
        const layout = this.getLayout();
        const count = Math.max(2, Math.min(8, playerCount || 2));
        const countScale = count <= 4
            ? 1
            : (count === 5 ? 0.9 : (count === 6 ? 0.82 : (count === 7 ? 0.74 : 0.68)));

        const scaled = Math.round((layout.WIDTH / 360) * 16 * countScale);
        return Math.max(11, Math.min(22, scaled));
    }

    /**
     * Get player container by index.
     * @param {number} index - Player index.
     * @returns {object | undefined}
     */
    getContainer(index) {
        return this.playerContainers[index];
    }

    /**
     * Get items container by player index.
     * @param {number} index - Player index.
     * @returns {Phaser.GameObjects.Container | null}
     */
    getItemsContainer(index) {
        return this.playerContainers[index]?.itemsContainer || null;
    }

    /**
     * Get all player containers.
     * @returns {Array<object>}
     */
    getContainers() {
        return this.playerContainers;
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

    /**
     * Render handcuff stacks on top-center of each avatar.
     * @param {object} state - Current scene state.
     */
    updateHandcuffIndicators(state) {
        if (!state?.players?.length) return;
        const showSelectionPlaceholders = !!this.scene.isAwaitingHandcuffTargetSelection?.();
        const selectedIndex = Number.isInteger(this.scene.targetedIndex) ? this.scene.targetedIndex : -1;

        this.playerContainers.forEach((pc, index) => {
            const player = state.players[index];
            const alive = !!player && player.alive !== false && player.health > 0;
            const handcuffStacks = alive ? Math.max(0, Number(player.turnsWaiting || 0)) : 0;
            const hasPersistentHandcuffs = handcuffStacks > 0;
            const hasPlaceholder = showSelectionPlaceholders && alive;

            if (!pc?.handcuffContainer || (!hasPersistentHandcuffs && !hasPlaceholder)) {
                pc?.handcuffContainer?.setVisible(false);
                return;
            }

            pc.handcuffContainer.setVisible(true);

            if (hasPersistentHandcuffs) {
                if (pc.handcuffIcon) pc.handcuffIcon.setAlpha(0.95);
                const hasMultiple = handcuffStacks > 1;
                if (pc.handcuffBadge) pc.handcuffBadge.setVisible(hasMultiple);
                if (pc.handcuffBadgeText) {
                    pc.handcuffBadgeText.setVisible(hasMultiple);
                    if (hasMultiple) pc.handcuffBadgeText.setText(String(handcuffStacks));
                }
                return;
            }

            const isSelected = index === selectedIndex;
            if (pc.handcuffIcon) pc.handcuffIcon.setAlpha(isSelected ? 0.62 : 0.28);
            if (pc.handcuffBadge) pc.handcuffBadge.setVisible(false);
            if (pc.handcuffBadgeText) pc.handcuffBadgeText.setVisible(false);
        });
    }

    /**
     * Update AFK indicators on avatars.
     * @param {object} state - Current scene state.
     */
    updateAfkBadges(state) {
        if (!this.scene.isMultiplayer || !state?.players?.length) return;
        const game = this.scene.gameStore?.currentGame;
        const nowMs = Date.now();
        const activePresenceKeys = new Set();

        this.playerContainers.forEach((pc, index) => {
            const player = state.players[index];
            const presenceKey = player?.userId || player?.id || `player_${index}`;
            activePresenceKeys.add(presenceKey);

            if (!pc?.afkBadge || !player || player.alive === false || player.health <= 0) {
                pc?.afkBadge?.setVisible(false);
                this.offlineSinceByUserId.delete(presenceKey);
                return;
            }

            const gamePlayer = (game?.players || []).find(p => p.userId === player.userId);
            const disconnected = gamePlayer?.isConnected === false || player.isConnected === false;
            if (!disconnected) {
                this.offlineSinceByUserId.delete(presenceKey);
                pc.afkBadge.setVisible(false);
                return;
            }

            let disconnectedSince = this.offlineSinceByUserId.get(presenceKey);
            if (!disconnectedSince) {
                disconnectedSince = nowMs;
                this.offlineSinceByUserId.set(presenceKey, disconnectedSince);
            }

            pc.afkBadge.setVisible((nowMs - disconnectedSince) >= 3000);
        });

        Array.from(this.offlineSinceByUserId.keys()).forEach((presenceKey) => {
            if (!activePresenceKeys.has(presenceKey)) {
                this.offlineSinceByUserId.delete(presenceKey);
            }
        });
    }
}
