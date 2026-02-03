/**
 * GunManager.js
 * Manages gun sprite, rotation, and knife/crossed revolvers visuals
 */

import { SCALE } from "../LayoutConfig.js";

export class GunManager {
    constructor(scene) {
        this.scene = scene;
        this.gunSprite = null;
        this.crossedRevolversSprite = null;
        this.nextAmmoSprite = null;
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
     * Set up gun sprites
     */
    setup() {
        const layout = this.getLayout();
        const scale = this.getScale();

        this.gunSprite = this.scene.add.image(layout.CENTER_X, layout.GUN_ZONE.y, "gun")
            .setScale(scale.GUN)
            .setOrigin(0.5, 0.5);

        // Next ammo reveal sprite (for magnifying glass)
        this.nextAmmoSprite = this.scene.add.image(layout.CENTER_X, layout.NEXT_AMMO_ZONE.y, "ammoUnknown")
            .setScale(scale.AMMO * 1.3)
            .setOrigin(0.5, 0.5)
            .setVisible(false);

        // Crossed revolvers sprite (Visual replacement for knife logic)
        this.crossedRevolversSprite = this.scene.add.image(layout.CENTER_X, layout.GUN_ZONE.y, "crossedRevolvers")
            .setScale(scale.GUN)
            .setOrigin(0.5, 0.5)
            .setVisible(false);
    }

    /**
     * Rotate gun to target before shooting
     */
    rotateToTarget(targetIndex, callback) {
        // Set angle based on target's vertical position relative to gun
        // Index 1 (BOT) is at the top -> point UP (90)
        // Index 0 (YOU) is at the bottom -> point DOWN (-90)
        const targetAngle = (targetIndex === 1 ? 90 : -90);

        // Ensure gun is on top
        this.gunSprite.setDepth(20);

        this.scene.tweens.add({
            targets: this.gunSprite,
            angle: targetAngle,
            duration: 200,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (callback) callback();
            }
        });
    }

    /**
     * Reset gun to neutral position
     */
    resetToNeutral() {
        this.scene.tweens.add({
            targets: [this.gunSprite, this.crossedRevolversSprite],
            angle: 0,
            duration: 280,
            ease: 'Cubic.easeOut'
        });
    }

    /**
     * Reset knife visuals if damage is back to 1
     */
    resetKnifeVisuals() {
        this.crossedRevolversSprite.setVisible(false);
        this.gunSprite.setVisible(true);
        this.gunSprite.clearTint();
    }

    /**
     * Show next ammo reveal (magnifying glass effect)
     */
    revealNextAmmo(nextRound) {
        const layout = this.getLayout();
        const scale = this.getScale();

        const ammoKey = nextRound ? "ammoFilled" : "ammoEmpty";
        this.nextAmmoSprite.setTexture(ammoKey);
        this.nextAmmoSprite.setVisible(true);
        this.nextAmmoSprite.setAlpha(0);
        this.nextAmmoSprite.setScale(0.1);

        this.scene.tweens.add({
            targets: this.nextAmmoSprite,
            alpha: 1,
            scale: scale.AMMO * 1.4,
            duration: 280,
            ease: 'Back.easeOut'
        });

        const glow = this.scene.add.circle(layout.CENTER_X, layout.NEXT_AMMO_ZONE.y, 22, nextRound ? 0xc62828 : 0x4a90d9, 0.35);
        this.scene.tweens.add({
            targets: glow,
            scale: { from: 0.5, to: 1.8 },
            alpha: 0,
            duration: 450,
            onComplete: () => glow.destroy()
        });
    }

    /**
     * Hide next ammo sprite
     */
    hideNextAmmo() {
        this.nextAmmoSprite.setVisible(false);
    }

    /**
     * Reset angles for new round
     */
    resetAngles() {
        this.gunSprite.setAngle(0);
        this.crossedRevolversSprite.setAngle(0);
    }

    /**
     * Get gun sprite for effects
     */
    getGunSprite() {
        return this.gunSprite;
    }

    /**
     * Get crossed revolvers sprite
     */
    getCrossedRevolversSprite() {
        return this.crossedRevolversSprite;
    }
}
