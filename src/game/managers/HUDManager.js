/**
 * HUDManager.js
 * Manages HUD elements: Round indicator, Turn indicator, and glow effects
 */

import { COLORS, FONTS } from "../LayoutConfig.js";

export class HUDManager {
    constructor(scene) {
        this.scene = scene;
        this.hudRound = null;
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
        const roundPanel = this.scene.add.container(60, 25);

        const roundBgGraphics = this.scene.add.graphics();
        roundBgGraphics.fillStyle(COLORS.PANEL_BG, 0.95);
        roundBgGraphics.lineStyle(1, COLORS.PANEL_BORDER);
        roundBgGraphics.fillRoundedRect(-45, -16, 90, 32, 8);
        roundBgGraphics.strokeRoundedRect(-45, -16, 90, 32, 8);

        this.hudRound = this.scene.add.text(0, -1, "Round 1", {
            ...FONTS.LABEL,
            fontSize: "13px"
        }).setOrigin(0.5);
        roundPanel.add([roundBgGraphics, this.hudRound]);

        // Turn indicator panel (top-right)
        const turnPanel = this.scene.add.container(layout.WIDTH - 70, 25);

        const turnBgGraphics = this.scene.add.graphics();

        this.hudTurn = this.scene.add.text(0, -1, "Your Turn", {
            ...FONTS.LABEL,
            fontSize: "12px",
            fontStyle: "700",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);
        this.hudTurn.setShadow(0, 1, "#000000", 2, true, true);
        this.turnBg = turnBgGraphics;
        this.turnPanel = turnPanel;
        turnPanel.add([turnBgGraphics, this.hudTurn]);

        // Turn glow indicator
        this.turnGlow = this.scene.add.graphics();
        this.turnGlow.setAlpha(0);
        this.applyTurnPanelStyle(COLORS.SUCCESS, 0x43a047, this.turnLabelRaw);
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
        const panelHeight = 34;
        const panelRadius = 10;
        const halfW = this.turnPanelWidth / 2;
        const halfH = panelHeight / 2;

        this.turnPanel.setPosition(layout.WIDTH - 10 - halfW, 25);

        this.turnBg.clear();
        this.turnBg.fillStyle(0x101823, 0.88);
        this.turnBg.lineStyle(2, borderHex, 0.9);
        this.turnBg.fillRoundedRect(-halfW, -halfH, this.turnPanelWidth, panelHeight, panelRadius);
        this.turnBg.strokeRoundedRect(-halfW, -halfH, this.turnPanelWidth, panelHeight, panelRadius);
        this.turnBg.lineStyle(1, 0xffffff, 0.08);
        this.turnBg.strokeRoundedRect(-halfW + 1, -halfH + 1, this.turnPanelWidth - 2, panelHeight - 2, panelRadius - 1);
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
                this.applyTurnPanelStyle(COLORS.TEXT_PRIMARY, COLORS.PANEL_BORDER);
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
            const turnColor = isMyTurn ? COLORS.SUCCESS : COLORS.DANGER;
            const turnColorHex = isMyTurn ? 0x43a047 : 0xc62828;
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
                            this.turnGlow.lineStyle(2, 0x43a047);
                            const glowWidth = this.turnPanelWidth + 6;
                            const glowX = this.turnPanel.x - (glowWidth / 2);
                            this.turnGlow.strokeRoundedRect(glowX, 25 - 18, glowWidth, 36, 11);

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
