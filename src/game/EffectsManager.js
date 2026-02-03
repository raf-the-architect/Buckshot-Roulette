/**
 * EffectsManager.js
 * Handles all visual effects: shoot, damage, heal, item effects
 */

import { ITEM_ASSET_MAP } from "./LayoutConfig.js";
import { ITEM_KEYS } from "./gameLogic.js";

export class EffectsManager {
    constructor(scene) {
        this.scene = scene;
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

    // ==========================================================================
    // DAMAGE EFFECT
    // ==========================================================================
    playDamageEffect(playerIndex) {
        const scale = this.getScale();
        const pc = this.scene.playerContainers[playerIndex];

        pc.avatar.setTint(0xc62828);
        this.scene.time.delayedCall(130, () => {
            pc.avatar.clearTint();
        });

        const hearts = pc.heartContainer.list;
        if (hearts.length > 0) {
            const lastFullHeartIdx = hearts.findLastIndex(h => h.texture.key === "heartFull");
            const targetHeart = lastFullHeartIdx !== -1 ? hearts[lastFullHeartIdx] : null;

            if (targetHeart) {
                this.scene.tweens.add({
                    targets: targetHeart,
                    y: targetHeart.y - 12,
                    scale: scale.HEART * 1.4,
                    alpha: 0,
                    duration: 280,
                    ease: 'Back.easeIn',
                    onComplete: () => {
                        targetHeart.setTexture("heartEmpty");
                        targetHeart.y = 0;
                        targetHeart.alpha = 0.4;
                        targetHeart.setScale(scale.HEART);
                    }
                });
            }
        }
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

        const chain = this.scene.add.image(pc.container.x, pc.container.y, "itemHandcuffs")
            .setScale(0.28)
            .setAlpha(0);

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
