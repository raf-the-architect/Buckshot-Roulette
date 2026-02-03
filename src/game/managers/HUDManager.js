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
        turnBgGraphics.fillStyle(COLORS.PANEL_BG, 0.95);
        turnBgGraphics.lineStyle(1, COLORS.PANEL_BORDER);
        turnBgGraphics.fillRoundedRect(-60, -16, 120, 32, 8);
        turnBgGraphics.strokeRoundedRect(-60, -16, 120, 32, 8);

        this.hudTurn = this.scene.add.text(0, -1, "Your Turn", {
            ...FONTS.LABEL,
            fontSize: "13px"
        }).setOrigin(0.5);
        this.turnBg = turnBgGraphics;
        this.turnPanel = turnPanel;
        turnPanel.add([turnBgGraphics, this.hudTurn]);

        // Turn glow indicator
        this.turnGlow = this.scene.add.graphics();
        this.turnGlow.lineStyle(2, 0x4a90d9);
        this.turnGlow.strokeRoundedRect(layout.WIDTH - 70 - 62, 25 - 18, 124, 36, 10);
        this.turnGlow.setAlpha(0);
    }

    /**
     * Update HUD with current game state
     */
    update(state) {
        const layout = this.getLayout();

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
            const turnName = currentActor.id === "YOU" ? "Your Turn" : "Dealer's Turn";
            const turnColor = currentActor.id === "YOU" ? COLORS.SUCCESS : COLORS.DANGER;
            const turnColorHex = currentActor.id === "YOU" ? 0x43a047 : 0xc62828;

            if (this.hudTurn.text !== turnName) {
                this.scene.tweens.add({
                    targets: [this.hudTurn, this.turnBg],
                    alpha: { from: 1, to: 0 },
                    duration: 120,
                    onComplete: () => {
                        this.hudTurn.setText(turnName);
                        this.hudTurn.setColor(turnColor);

                        // Update Graphics Stroke
                        this.turnBg.clear();
                        this.turnBg.fillStyle(COLORS.PANEL_BG, 0.95);
                        this.turnBg.lineStyle(1, turnColorHex);
                        this.turnBg.fillRoundedRect(-60, -16, 120, 32, 8);
                        this.turnBg.strokeRoundedRect(-60, -16, 120, 32, 8);

                        this.scene.tweens.add({
                            targets: [this.hudTurn, this.turnBg],
                            alpha: { from: 0, to: 1 },
                            duration: 120
                        });

                        // Single Pulse on turn start (If it's YOUR turn)
                        if (currentActor.id === "YOU") {
                            this.turnGlow.clear();
                            this.turnGlow.lineStyle(2, 0x43a047);
                            this.turnGlow.strokeRoundedRect(layout.WIDTH - 70 - 62, 25 - 18, 124, 36, 10);

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
