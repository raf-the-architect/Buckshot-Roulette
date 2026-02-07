/**
 * AmmoRenderer.js
 * Renders ammo container with reveal animations
 */

export class AmmoRenderer {
    constructor(scene) {
        this.scene = scene;
        this.ammoContainer = null;
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
     * Set up ammo container
     */
    setup() {
        const layout = this.getLayout();
        this.ammoContainer = this.scene.add.container(layout.CENTER_X, layout.AMMO_ZONE.y);
    }

    /**
     * Render ammo based on current game state
     */
    render(roundStartTotal, roundStartLive, firedShots, ammoRevealPhase, nextAmmoRevealed = null) {
        const scale = this.getScale();
        this.ammoContainer.removeAll(true);
        const normalizedReveal = nextAmmoRevealed === true
            ? "live"
            : (nextAmmoRevealed === false ? "blank" : nextAmmoRevealed);

        const totalSlots = roundStartTotal;
        const fired = firedShots.length;

        const ammoSpacing = 28;
        const startX = -((totalSlots - 1) * ammoSpacing) / 2;

        for (let i = 0; i < totalSlots; i++) {
            let ammoKey;

            if (i < fired) {
                ammoKey = firedShots[i].wasLive ? "ammoFilled" : "ammoEmpty";
            } else if (ammoRevealPhase) {
                const liveCount = roundStartLive;
                const firedLive = firedShots.filter(s => s.wasLive).length;
                const remainingLive = liveCount - firedLive;
                const remainingSlotIndex = i - fired;

                if (remainingSlotIndex < remainingLive) {
                    ammoKey = "ammoFilled";
                } else {
                    ammoKey = "ammoEmpty";
                }
            } else {
                ammoKey = "ammoUnknown";
            }

            const ammo = this.scene.imageService.createImage(startX + i * ammoSpacing, 0, ammoKey, {
                scale: scale.AMMO
            });

            // Fired shells stay fully visible once revealed
            if (i < fired) {
                ammo.setAlpha(1);
            }

            // Magnifying glass reveal for next round only (local player view)
            if (!ammoRevealPhase && i === fired && (normalizedReveal === "live" || normalizedReveal === "blank")) {
                ammo.setTexture(normalizedReveal === "live" ? "ammoFilled" : "ammoEmpty");
                ammo.setAlpha(0.5);
            }

            if (ammoRevealPhase && i >= fired) {
                ammo.setAlpha(0);
                this.scene.tweens.add({
                    targets: ammo,
                    alpha: 1,
                    scale: scale.AMMO * 1.15,
                    duration: 250,
                    delay: (i - fired) * 120,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: ammo,
                            scale: scale.AMMO,
                            duration: 100
                        });
                    }
                });
            }

            this.ammoContainer.add(ammo);
        }
    }

    /**
     * Get ammo container for animations
     */
    getContainer() {
        return this.ammoContainer;
    }

    /**
     * Set container alpha
     */
    setAlpha(alpha) {
        this.ammoContainer.setAlpha(alpha);
    }
}
