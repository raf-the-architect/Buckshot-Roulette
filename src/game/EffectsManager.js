/**
 * EffectsManager.js
 * Handles all visual effects: shoot, damage, heal, item effects
 */

import { ITEM_ASSET_MAP } from "./LayoutConfig.js";
import { ITEM_KEYS } from "./gameLogic.js";

const GUN_IMPACT_DEPTH = 90;
const GUN_IMPACT_ANTICIPATION_MS = 140;
const GUN_IMPACT_LUNGE_MS = 200;
const GUN_IMPACT_HOLD_MS = 760;
const GUN_IMPACT_EXIT_MS = 260;
const GUN_IMPACT_TOTAL_MS =
    GUN_IMPACT_ANTICIPATION_MS +
    GUN_IMPACT_LUNGE_MS +
    GUN_IMPACT_HOLD_MS +
    GUN_IMPACT_EXIT_MS;

export class EffectsManager {
    constructor(scene) {
        this.scene = scene;
        this.gunImpactSprite = null;
        this.gunImpactWash = null;
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

    // ==========================================================================
    // EFFECT PRIORITY SYSTEM
    // ==========================================================================
    triggerEffect(type, params) {
        const layout = this.getLayout();

        if (type === "shake") {
            if (this.scene.isShaking) return;
            this.scene.isShaking = true;
            this.scene.cameras.main.shake(params.duration || 120, params.intensity || 0.006);
            this.scene.time.delayedCall(params.duration || 120, () => this.scene.isShaking = false);
        } else if (type === "flash") {
            const flash = this.scene.add.rectangle(
                layout.CENTER_X, layout.HEIGHT / 2,
                layout.WIDTH, layout.HEIGHT,
                params.color || 0xffffff, params.alpha || 0.4
            ).setDepth(1000);
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: params.duration || 250,
                onComplete: () => flash.destroy()
            });
        }
    }

    // ==========================================================================
    // SHOOT EFFECTS
    // ==========================================================================
    playShootEffect(wasLive, action) {
        const layout = this.getLayout();
        const gunSprite = this.scene.gunSprite;

        if (wasLive) {
            const flash = this.scene.add.circle(layout.CENTER_X, layout.GUN_ZONE.y, 35, 0xffcc00, 1);
            this.scene.tweens.add({
                targets: flash,
                scale: { from: 0.3, to: 1.4 },
                alpha: { from: 1, to: 0 },
                duration: 180,
                onComplete: () => flash.destroy()
            });

            this.triggerEffect("shake", { duration: 120, intensity: 0.006 });

            this.scene.tweens.add({
                targets: gunSprite,
                angle: { from: gunSprite.angle - 8, to: gunSprite.angle },
                duration: 180,
                ease: 'Back.easeOut'
            });

            this.triggerEffect("flash", { color: 0xc62828, alpha: 0.2, duration: 250 });
        } else {
            // Dry fire - softer effect
            const puff = this.scene.add.circle(layout.CENTER_X, layout.GUN_ZONE.y - 12, 12, 0x4a90d9, 0.5);
            this.scene.tweens.add({
                targets: puff,
                scale: { from: 0.5, to: 1.8 },
                alpha: 0,
                y: layout.GUN_ZONE.y - 35,
                duration: 320,
                onComplete: () => puff.destroy()
            });

            // Subtle wobble
            this.scene.tweens.add({
                targets: gunSprite,
                angle: { from: gunSprite.angle - 2, to: gunSprite.angle + 2 },
                duration: 60,
                yoyo: true,
                repeat: 1
            });
        }
    }

    /**
     * Destroy any active gun-impact sprite and stop tweens.
     */
    clearGunImpactEffect() {
        if (this.gunImpactSprite) {
            this.scene.tweens.killTweensOf(this.gunImpactSprite);
            this.gunImpactSprite.destroy();
            this.gunImpactSprite = null;
        }
        if (this.gunImpactWash) {
            this.scene.tweens.killTweensOf(this.gunImpactWash);
            this.gunImpactWash.destroy();
            this.gunImpactWash = null;
        }
    }

    /**
     * Play high-impact revolver overlay animation.
     * @param {{targetIndex?: number, wasLive?: boolean, shouldDisplay?: boolean}} params
     * @returns {number} Effect duration in milliseconds.
     */
    playGunImpactEffect(params = {}) {
        const {
            targetIndex = null,
            wasLive = false,
            shouldDisplay = true
        } = params;

        this.clearGunImpactEffect();
        if (!shouldDisplay) return 0;

        const layout = this.getLayout();
        const targetContainer = Number.isInteger(targetIndex)
            ? this.scene.players?.getContainer?.(targetIndex)?.container
            : null;
        const targetY = targetContainer?.y ?? (layout.HEIGHT / 2);
        const impactY = Phaser.Math.Clamp(targetY, layout.HEIGHT * 0.36, layout.HEIGHT * 0.64);

        const impact = this.scene.imageService.createImage(
            layout.CENTER_X,
            impactY,
            "revolverImpact",
            {
                alpha: 0,
                depth: GUN_IMPACT_DEPTH
            }
        );
        this.gunImpactSprite = impact;

        const targetWidth = Math.round(layout.WIDTH * 0.9);
        this.scene.imageService.setScaleFromWidth(impact, targetWidth);
        if (impact.displayHeight > layout.HEIGHT * 0.95) {
            this.scene.imageService.fitImageToBounds(impact, targetWidth, layout.HEIGHT * 0.95, {
                allowUpscale: true
            });
        }

        const finalScaleX = impact.scaleX;
        const finalScaleY = impact.scaleY;
        impact.setScale(finalScaleX * 0.68, finalScaleY * 0.68);
        impact.setY(impactY + 26);
        impact.setAngle(0);

        const threatWash = this.scene.add.rectangle(
            layout.CENTER_X,
            layout.HEIGHT / 2,
            layout.WIDTH,
            layout.HEIGHT,
            wasLive ? 0x720707 : 0x2f1a1a,
            wasLive ? 0.26 : 0.12
        ).setDepth(GUN_IMPACT_DEPTH - 1);
        this.gunImpactWash = threatWash;

        if (this.scene.cache?.audio?.exists?.("sndGunImpactHit")) {
            try {
                this.scene.sound.play("sndGunImpactHit", { volume: 0.5 });
            } catch (_err) {
                // Optional hook: ignore failures when key isn't ready.
            }
        }

        this.triggerEffect("shake", {
            duration: wasLive ? 170 : 120,
            intensity: wasLive ? 0.0105 : 0.0045
        });
        this.triggerEffect("flash", {
            color: wasLive ? 0x8f0a0a : 0x2f1a1a,
            alpha: wasLive ? 0.28 : 0.14,
            duration: 220
        });

        this.scene.tweens.add({
            targets: impact,
            alpha: 0.62,
            scaleX: finalScaleX * 0.8,
            scaleY: finalScaleY * 0.8,
            y: impactY + 10,
            duration: GUN_IMPACT_ANTICIPATION_MS,
            ease: "Quad.easeOut",
            onComplete: () => {
                if (!this.gunImpactSprite || this.gunImpactSprite !== impact) return;
                this.scene.tweens.add({
                    targets: impact,
                    alpha: 1,
                    scaleX: finalScaleX,
                    scaleY: finalScaleY,
                    y: impactY - (wasLive ? 6 : 2),
                    duration: GUN_IMPACT_LUNGE_MS,
                    ease: "Cubic.easeOut",
                    onComplete: () => {
                        if (!this.gunImpactSprite || this.gunImpactSprite !== impact) return;

                        const jitterTween = this.scene.tweens.add({
                            targets: impact,
                            x: {
                                from: layout.CENTER_X - (wasLive ? 5 : 3),
                                to: layout.CENTER_X + (wasLive ? 5 : 3)
                            },
                            y: {
                                from: impactY - (wasLive ? 8 : 3),
                                to: impactY - (wasLive ? 2 : 0)
                            },
                            angle: { from: wasLive ? -1.4 : -0.7, to: wasLive ? 1.4 : 0.7 },
                            duration: 52,
                            yoyo: true,
                            repeat: -1
                        });

                        this.scene.time.delayedCall(GUN_IMPACT_HOLD_MS, () => {
                            if (!this.gunImpactSprite || this.gunImpactSprite !== impact) return;
                            jitterTween.stop();
                            jitterTween.remove();
                            impact.setPosition(layout.CENTER_X, impactY - 2);
                            impact.setAngle(0);

                            this.scene.tweens.add({
                                targets: impact,
                                alpha: 0,
                                scaleX: finalScaleX * 0.9,
                                scaleY: finalScaleY * 0.9,
                                y: impactY + 18,
                                duration: GUN_IMPACT_EXIT_MS,
                                ease: "Cubic.easeIn",
                                onComplete: () => {
                                    if (this.gunImpactSprite === impact) {
                                        this.clearGunImpactEffect();
                                    }
                                }
                            });
                        });
                    }
                });
            }
        });

        this.scene.tweens.add({
            targets: threatWash,
            alpha: 0,
            duration: wasLive ? 520 : 360,
            ease: "Quad.easeOut",
            onComplete: () => {
                if (this.gunImpactWash === threatWash) {
                    this.gunImpactWash = null;
                }
                threatWash.destroy();
            }
        });

        return GUN_IMPACT_TOTAL_MS;
    }

    // ==========================================================================
    // DAMAGE EFFECT
    // ==========================================================================
    playDamageEffect(playerIndex) {
        const pc = this.scene.playerContainers[playerIndex];
        if (!pc?.avatar || !pc?.container) return;

        pc.avatar.setTint(0xc62828);
        this.scene.time.delayedCall(130, () => {
            pc.avatar.clearTint();
        });

        // Visual hit pulse only; health/hearts must always come from authoritative state.
        const hitPulse = this.scene.add.circle(pc.container.x, pc.container.y, 34, 0xc62828, 0.45);
        this.scene.tweens.add({
            targets: hitPulse,
            scale: { from: 0.8, to: 1.8 },
            alpha: 0,
            duration: 260,
            ease: 'Quad.easeOut',
            onComplete: () => hitPulse.destroy()
        });
    }

    // ==========================================================================
    // ITEM EFFECTS
    // ==========================================================================
    playItemEffect(itemKey, actorId) {
        const layout = this.getLayout();
        const isBot = actorId === "BOT";
        const baseY = isBot ? layout.BOT_ITEMS_ZONE.y : layout.PLAYER_ITEMS_ZONE.y;

        const color = this.getItemColor(itemKey);
        for (let i = 0; i < 5; i++) {
            const sparkle = this.scene.add.circle(
                layout.CENTER_X + Phaser.Math.Between(-35, 35),
                baseY + Phaser.Math.Between(-15, 15),
                4,
                color,
                0.8
            );
            this.scene.tweens.add({
                targets: sparkle,
                scale: { from: 1, to: 0 },
                y: sparkle.y - 25,
                alpha: 0,
                duration: 350,
                delay: i * 40,
                onComplete: () => sparkle.destroy()
            });
        }
    }

    playBeerEffect(wasLive) {
        const layout = this.getLayout();
        const color = wasLive ? 0xc62828 : 0x4a90d9;
        const eject = this.scene.add.circle(layout.CENTER_X + 28, layout.GUN_ZONE.y, 7, color, 0.9);
        this.scene.tweens.add({
            targets: eject,
            x: layout.CENTER_X + 90,
            y: layout.GUN_ZONE.y + 45,
            rotation: 2.5,
            alpha: 0,
            duration: 450,
            onComplete: () => eject.destroy()
        });
    }

    playHealEffect(playerIndex) {
        const pc = this.scene.playerContainers[playerIndex];

        pc.avatar.setTint(0x43a047);
        this.scene.time.delayedCall(280, () => {
            pc.avatar.clearTint();
        });

        for (let i = 0; i < 3; i++) {
            const plus = this.scene.add.circle(
                pc.container.x + Phaser.Math.Between(-18, 18),
                pc.container.y - 18,
                5,
                0x43a047,
                0.7
            );
            this.scene.tweens.add({
                targets: plus,
                y: plus.y - 35,
                alpha: 0,
                duration: 550,
                delay: i * 80,
                onComplete: () => plus.destroy()
            });
        }
    }

    playHandcuffEffect(targetIndex) {
        const pc = this.scene.playerContainers[targetIndex];

        const chain = this.scene.imageService.createImage(pc.container.x, pc.container.y, "itemHandcuffs", {
            scale: 0.28,
            alpha: 0
        });

        this.scene.tweens.add({
            targets: chain,
            alpha: 1,
            scale: 0.14,
            duration: 280,
            yoyo: true,
            hold: 280,
            onComplete: () => chain.destroy()
        });

        pc.avatar.setTint(0x666666);
        this.scene.time.delayedCall(380, () => {
            pc.avatar.clearTint();
        });
    }

    playKnifeEffect() {
        const layout = this.getLayout();
        const scale = this.getScale();
        const crossedRevolversSprite = this.scene.crossedRevolversSprite;
        const gunSprite = this.scene.gunSprite;

        crossedRevolversSprite.setVisible(true);
        crossedRevolversSprite.setAlpha(0);
        crossedRevolversSprite.setScale(scale.GUN);

        gunSprite.setVisible(false);

        this.scene.tweens.add({
            targets: crossedRevolversSprite,
            alpha: 1,
            scale: scale.GUN,
            duration: 280,
            ease: 'Back.easeOut'
        });

        const slash = this.scene.add.rectangle(layout.CENTER_X - 18, layout.GUN_ZONE.y, 55, 3, 0xc62828, 1)
            .setAngle(-45);
        this.scene.tweens.add({
            targets: slash,
            x: layout.CENTER_X + 18,
            alpha: 0,
            duration: 180,
            onComplete: () => slash.destroy()
        });
    }

    // ==========================================================================
    // HELPERS
    // ==========================================================================
    getItemColor(itemKey) {
        const colors = {
            [ITEM_KEYS.KNIFE]: 0xc62828,
            [ITEM_KEYS.MAGNIFYING_GLASS]: 0x4a90d9,
            [ITEM_KEYS.HANDCUFFS]: 0x888888,
            [ITEM_KEYS.BEER]: 0xf9a825,
            [ITEM_KEYS.CIGARETTE]: 0x43a047
        };
        return colors[itemKey] || 0xffffff;
    }
}
