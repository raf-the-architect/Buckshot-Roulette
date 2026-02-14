/**
 * HUDManager.js
 * Manages HUD elements: Round indicator, Turn indicator, and glow effects
 */

import { FONTS } from "../LayoutConfig.js";

export class HUDManager {
    constructor(scene) {
        this.scene = scene;
        this.hudRound = null;
        this.roundBg = null;
        this.roundPanel = null;
        this.roundPanelWidth = 116;
        this.hudTurn = null;
        this.turnBg = null;
        this.turnPanel = null;
        this.turnGlow = null;
        this.lastTurnBorderHex = null;
        this.turnLabelRaw = "Your Turn";
        this.turnPanelWidth = 128;
    }

    /**
     * Get current layout dynamically from scene
     */
    getLayout() {
        return this.scene.getLayout();
    }

    /**
     * Set up HUD panels
     */
    setup() {
        const layout = this.getLayout();

        // Round indicator panel (top-left)
        const roundPanel = this.scene.add.container(14 + (this.roundPanelWidth / 2), 27);
        const roundBgGraphics = this.scene.add.graphics();
        this.roundBg = roundBgGraphics;
        this.roundPanel = roundPanel;

        this.hudRound = this.scene.add.text(0, -1, "Round 1", {
            ...FONTS.LABEL,
            fontSize: "20px",
            fontStyle: "bold",
            color: "#fff8f8ff"
        }).setOrigin(0.5);
        this.hudRound.setStroke("#081d35", 3);
        this.hudRound.setShadow(0, 1, "#000000", 2, true, true);
        roundPanel.add([roundBgGraphics, this.hudRound]);
        this.redrawRoundDecor();

        // Turn indicator panel (top-right)
        const turnPanel = this.scene.add.container(layout.WIDTH - 70, 27);

        const turnBgGraphics = this.scene.add.graphics();

        this.hudTurn = this.scene.add.text(0, -1, "Your Turn", {
            ...FONTS.LABEL,
            fontSize: "20px",
            fontStyle: "bold",
            color: "#f8fbff"
        }).setOrigin(0.5);
        this.hudTurn.setStroke("#081d35", 3);
        this.hudTurn.setShadow(0, 1, "#000000", 2, true, true);
        this.turnBg = turnBgGraphics;
        this.turnPanel = turnPanel;
        turnPanel.add([turnBgGraphics, this.hudTurn]);

        // Turn glow indicator
        this.turnGlow = this.scene.add.graphics();
        this.turnGlow.setAlpha(0);
        this.applyTurnPanelStyle("#f8fbff", 0x3d9edc, this.turnLabelRaw);
    }

    /**
     * Draw a clean, high-contrast top-bar tag for readable HUD labels.
     * @param {Phaser.GameObjects.Graphics} graphics - Graphics object.
     * @param {number} x - Left coordinate.
     * @param {number} y - Top coordinate.
     * @param {number} width - Tag width.
     * @param {number} height - Tag height.
     * @param {number} radius - Tag corner radius.
     * @param {number} accentHex - Accent color for inner border.
     */
    drawTagBackground(graphics, x, y, width, height, radius, accentHex = 0x3d9edc) {
        graphics.clear();
        graphics.fillStyle(0x132f4f, 0.92);
        graphics.fillRoundedRect(x, y, width, height, radius);
        graphics.lineStyle(1, accentHex, 0.78);
        graphics.strokeRoundedRect(x, y, width, height, radius);
        graphics.lineStyle(1, 0xffffff, 0.12);
        graphics.strokeRoundedRect(x + 1, y + 1, width - 2, height - 2, Math.max(2, radius - 1));
    }

    /**
     * Draw round panel background to current dimensions.
     */
    redrawRoundDecor() {
        if (!this.roundBg || !this.roundPanel) return;
        const layout = this.getLayout();
        if (this.hudRound) {
            this.hudRound.setStyle({
                ...FONTS.LABEL,
                fontSize: "20px",
                fontStyle: "bold"
            });
            this.hudRound.setStroke("#081d35", 3);
        }
        this.roundPanelWidth = Phaser.Math.Clamp(
            Math.ceil((this.hudRound?.width || this.roundPanelWidth) + 32),
            116,
            Math.floor(layout.WIDTH * 0.45)
        );
        const panelHeight = 36;
        const panelRadius = 8;
        const halfW = this.roundPanelWidth / 2;
        const halfH = panelHeight / 2;

        this.roundPanel.setPosition(14 + halfW, 27);
        this.drawTagBackground(
            this.roundBg,
            -halfW,
            -halfH,
            this.roundPanelWidth,
            panelHeight,
            panelRadius,
            0x3e86cc
        );
    }

    /**
     * Truncate text to fit max pixel width.
     * @param {string} text - Input text.
     * @param {number} maxWidth - Pixel width budget.
     * @returns {string}
     */
    fitTurnText(text, maxWidth) {
        if (!this.hudTurn) return text;

        this.hudTurn.setText(text);
        if (this.hudTurn.width <= maxWidth) return text;

        const source = String(text || "");
        let lo = 1;
        let hi = source.length;
        let best = source.slice(0, 1) + "...";

        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const candidate = `${source.slice(0, mid).trimEnd()}...`;
            this.hudTurn.setText(candidate);
            if (this.hudTurn.width <= maxWidth) {
                best = candidate;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }

        return best;
    }

    /**
     * Draw turn panel background + glow to current dynamic dimensions.
     * @param {number} borderHex - Border color.
     */
    redrawTurnDecor(borderHex) {
        const layout = this.getLayout();
        const panelHeight = 36;
        const panelRadius = 8;
        const halfW = this.turnPanelWidth / 2;
        const halfH = panelHeight / 2;

        this.turnPanel.setPosition(layout.WIDTH - 14 - halfW, 27);
        this.drawTagBackground(this.turnBg, -halfW, -halfH, this.turnPanelWidth, panelHeight, panelRadius, borderHex);
    }

    /**
     * Apply turn panel border/text color without requiring turn text changes.
     */
    applyTurnPanelStyle(turnColor, turnColorHex, rawLabel = this.turnLabelRaw || "Turn") {
        if (!this.hudTurn || !this.turnBg || !this.turnPanel) return;

        const layout = this.getLayout();
        const horizontalPadding = 18;
        const minWidth = 120;
        const maxWidth = Math.max(minWidth, Math.floor(layout.WIDTH * 0.74));
        this.hudTurn.setStyle({
            ...FONTS.LABEL,
            fontSize: "20px",
            fontStyle: "bold"
        });
        this.hudTurn.setStroke("#081d35", 3);

        const fittedLabel = this.fitTurnText(rawLabel, maxWidth - (horizontalPadding * 2));
        this.hudTurn.setText(fittedLabel);
        this.hudTurn.setColor(turnColor);
        this.turnPanelWidth = Phaser.Math.Clamp(
            Math.ceil(this.hudTurn.width + (horizontalPadding * 2)),
            minWidth,
            maxWidth
        );
        this.redrawTurnDecor(turnColorHex);
        this.lastTurnBorderHex = turnColorHex;
    }

    /**
     * Update HUD with current game state
     */
    update(state) {
        // Update round text with animation
        if (this.hudRound) {
            this.redrawRoundDecor();
            const newRoundText = `Round ${state.roundNumber}`;
            if (this.hudRound.text !== newRoundText) {
                this.scene.tweens.add({
                    targets: this.hudRound,
                    scale: { from: 1, to: 1.15 },
                    duration: 150,
                    yoyo: true,
                    onStart: () => this.hudRound.setText(newRoundText)
                });
            }
        }

        // Update turn indicator with animation
        if (this.hudTurn) {
            const currentActor = state.players[state.currentTurnIndex];
            if (!currentActor) {
                this.turnLabelRaw = "Waiting...";
                this.applyTurnPanelStyle("#f8fbff", 0x4f95d6);
                return;
            }
            const isMyTurn = this.scene.isMultiplayer
                ? !!this.scene.gameStore?.isMyTurn
                : currentActor.id === "YOU";

            let turnName = "Dealer's Turn";
            if (isMyTurn) {
                turnName = "Your Turn";
            } else if (this.scene.isMultiplayer) {
                const actorName = currentActor.displayName || currentActor.name || currentActor.id || "Opponent";
                turnName = `${actorName} Turn`;
            }
            const turnColor = "#f8fbff";
            const turnColorHex = isMyTurn ? 0x61c884 : 0xe59a42;
            const textChanged = this.turnLabelRaw !== turnName;

            if (!textChanged) {
                // Keep panel adaptive on resizes and keep style polished each frame.
                this.applyTurnPanelStyle(turnColor, turnColorHex, this.turnLabelRaw);
            }

            if (textChanged) {
                this.scene.tweens.add({
                    targets: [this.hudTurn, this.turnBg],
                    alpha: { from: 1, to: 0 },
                    duration: 120,
                    onComplete: () => {
                        this.turnLabelRaw = turnName;
                        this.applyTurnPanelStyle(turnColor, turnColorHex, turnName);

                        this.scene.tweens.add({
                            targets: [this.hudTurn, this.turnBg],
                            alpha: { from: 0, to: 1 },
                            duration: 120
                        });

                        // Single Pulse on turn start (If it's YOUR turn)
                        if (isMyTurn) {
                            this.turnGlow.clear();
                            this.turnGlow.lineStyle(1, 0xffffff, 0.45);
                            const glowWidth = this.turnPanelWidth + 4;
                            const glowX = this.turnPanel.x - (glowWidth / 2);
                            const glowY = this.turnPanel.y - 16;
                            this.turnGlow.strokeRoundedRect(glowX, glowY, glowWidth, 32, 8);

                            this.turnGlow.setAlpha(0.8);
                            this.scene.tweens.add({
                                targets: this.turnGlow,
                                alpha: 0,
                                scaleX: 1.05,
                                scaleY: 1.1,
                                duration: 500,
                                ease: 'Quad.out'
                            });
                        }
                    }
                });
            }
        }
    }
}
