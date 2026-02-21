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

        this.gunSprite = this.scene.imageService.createImage(layout.CENTER_X, layout.GUN_ZONE.y, "gun", {
            scale: scale.GUN
        });

        // Next ammo reveal sprite (for magnifying glass)
        this.nextAmmoSprite = this.scene.imageService.createImage(layout.CENTER_X, layout.NEXT_AMMO_ZONE.y, "ammoUnknown", {
            scale: scale.AMMO * 1.3,
            visible: false
        });

        // Crossed revolvers sprite (Visual replacement for knife logic)
        this.crossedRevolversSprite = this.scene.imageService.createImage(layout.CENTER_X, layout.GUN_ZONE.y, "crossedRevolvers", {
            scale: scale.GUN,
            visible: false
        });
    }

    /**
     * Rotate gun to target before shooting.
     * Supports both 1v1 and multi-avatar layouts.
     */
    rotateToTarget(targetIndex, callback) {
        const targetContainer = this.scene.players?.getContainer?.(targetIndex);
        let targetAngle;

        if (targetContainer) {
            const dx = targetContainer.container.x - this.gunSprite.x;
            const dy = targetContainer.container.y - this.gunSprite.y;
            // Neutral sprite orientation is 9 o'clock (left) at angle 0.
            // Convert world direction into a relative angle in [-180, 180]:
            // 12 o'clock -> +90, 6 o'clock -> -90, 3 o'clock -> ±180.
            const worldAngleDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
            targetAngle = Phaser.Math.Angle.WrapDegrees(worldAngleDeg - 180);
        } else {
            targetAngle = (targetIndex === 1 ? 90 : -90);
        }

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
        const isLiveRound = !!nextRound;

        const ammoKey = isLiveRound ? "ammoFilled" : "ammoEmpty";
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

        const glow = this.scene.add.circle(
            layout.CENTER_X,
            layout.NEXT_AMMO_ZONE.y,
            isLiveRound ? 28 : 22,
            isLiveRound ? 0xc62828 : 0x4a90d9,
            isLiveRound ? 0.46 : 0.3
        );
        this.scene.tweens.add({
            targets: glow,
            scale: { from: 0.5, to: isLiveRound ? 2.25 : 1.7 },
            alpha: 0,
            duration: isLiveRound ? 560 : 420,
            onComplete: () => glow.destroy()
        });

        if (isLiveRound) {
            const threatWash = this.scene.add.rectangle(
                layout.CENTER_X,
                layout.HEIGHT / 2,
                layout.WIDTH,
                layout.HEIGHT,
                0x6d0505,
                0.2
            ).setDepth(92);

            this.scene.tweens.add({
                targets: threatWash,
                alpha: 0,
                duration: 320,
                onComplete: () => threatWash.destroy()
            });
        }
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
