/**
 * ActionHandler.js
 * Handles action processing and action indicator display
 */

import { applyAction, ITEM_KEYS } from "../gameLogic.js";
import { ITEM_ASSET_MAP, SCALE } from "../LayoutConfig.js";

export class ActionHandler {
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

    /**
     * Show action indicator for an action
     */
    showActionIndicator(actorId, actionType, itemKey = null) {
        const layout = this.getLayout();
        const scale = this.getScale();
        const actionIndicator = this.scene.ui.getActionIndicator();
        actionIndicator.removeAll(true);

        const isBot = actorId === "BOT";
        const y = isBot ? -170 : 170;

        let iconKey = null;
        let color = 0xffffff;

        if (actionType === "USE_ITEM" && itemKey) {
            iconKey = ITEM_ASSET_MAP[itemKey];
            color = this.scene.effects.getItemColor(itemKey);
        } else if (actionType === "SHOOT_PLAYER") {
            color = 0xc62828;
        } else if (actionType === "SHOOT_SELF") {
            color = 0x4a90d9;
        }

        const bg = this.scene.add.circle(0, y, 30, color, 0.25);
        actionIndicator.add(bg);

        if (iconKey) {
            const icon = this.scene.add.image(0, y, iconKey)
                .setScale(scale.ITEM * 1.8)
                .setOrigin(0.5, 0.5);
            actionIndicator.add(icon);

            this.scene.tweens.add({
                targets: [bg, icon],
                scale: { from: 0.5, to: 1.1 },
                duration: 180,
                ease: 'Back.easeOut',
                yoyo: true,
                hold: 350,
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: [bg, icon],
                        alpha: 0,
                        duration: 180,
                        onComplete: () => actionIndicator.removeAll(true)
                    });
                }
            });
        } else {
            this.scene.tweens.add({
                targets: bg,
                scale: { from: 0.3, to: 1.4 },
                alpha: { from: 0.5, to: 0 },
                duration: 350,
                onComplete: () => actionIndicator.removeAll(true)
            });
        }
    }

    /**
     * Execute an action with all visual effects
     */
    execute(action, actorId) {
        const chamber = this.scene.state.shotgun.chamber;
        const prevChamberLength = chamber.length;

        let wasLive = false;
        const isShot = action.type.startsWith("SHOOT");
        const isBeer = action.type === "USE_ITEM" && action.item === ITEM_KEYS.BEER;

        if ((isShot || isBeer) && prevChamberLength > 0) {
            wasLive = !!chamber[chamber.length - 1];
        }

        this.showActionIndicator(actorId, action.type, action.item);

        // Gun rotation logic - EXPLICIT TARGETING
        if (action.type === "SHOOT_PLAYER") {
            this.scene.targetedIndex = (actorId === "YOU" ? 1 : 0);
        } else if (action.type === "SHOOT_SELF") {
            this.scene.targetedIndex = (actorId === "YOU" ? 0 : 1);
        }

        this.scene.players.updateAvatarStates(this.scene.state, this.scene.targetedIndex);

        if (isShot) {
            this.scene.isProcessing = true;

            this.scene.gun.rotateToTarget(this.scene.targetedIndex, null);

            this.scene.time.delayedCall(300, () => {
                this.processAction(action, actorId, wasLive, prevChamberLength);
            });
        } else {
            this.processAction(action, actorId, wasLive, prevChamberLength);
        }
    }

    /**
     * Process action after any pre-animations
     */
    processAction(action, actorId, wasLive, prevChamberLength) {
        const isShot = action.type.startsWith("SHOOT");
        const isBeer = action.type === "USE_ITEM" && action.item === ITEM_KEYS.BEER;
        const prevHealth = this.scene.state.players.map(p => p.health);

        if (action.type === "USE_ITEM") {
            console.log(`[ACTION] ${actorId} used ${action.item}`);
        } else {
            const targetStr = action.type === "SHOOT_PLAYER" ? (actorId === "YOU" ? "BOT" : "YOU") : actorId;
            console.log(`[ACTION] ${actorId} shot ${targetStr}`);
        }

        this.scene.state = applyAction(this.scene.state, action, this.scene.rng);

        if (isShot) {
            this.scene.firedShots.push({ wasLive });

            console.log(`[RESULT] ${wasLive ? "💥 LIVE ROUND!" : "💨 BLANK ROUND"}`);

            this.scene.nextAmmoRevealed = null;
            this.scene.gun.hideNextAmmo();

            if (wasLive) {
                this.scene.sound.play("sndGunshot");
            } else {
                this.scene.sound.play("sndDryFire");
            }
            this.scene.effects.playShootEffect(wasLive, action);

            const crossedRevolvers = this.scene.gun.getCrossedRevolversSprite();
            const gunSprite = this.scene.gun.getGunSprite();
            crossedRevolvers.setVisible(false);
            gunSprite.setVisible(true);
            gunSprite.clearTint();

            this.scene.state.players.forEach((p, i) => {
                if (p.health < prevHealth[i]) {
                    this.scene.effects.playDamageEffect(i);
                }
            });
        }

        if (action.type === "USE_ITEM") {
            this.scene.effects.playItemEffect(action.item, actorId);

            if (isBeer && prevChamberLength > 0) {
                this.scene.firedShots.push({ wasLive });
                this.scene.effects.playBeerEffect(wasLive);
            }

            if (action.item === ITEM_KEYS.MAGNIFYING_GLASS) {
                this.scene.round.revealNextAmmo();
            }

            if (action.item === ITEM_KEYS.CIGARETTE) {
                const idx = actorId === "YOU" ? 0 : 1;
                this.scene.effects.playHealEffect(idx);
            }

            if (action.item === ITEM_KEYS.HANDCUFFS) {
                const targetIdx = actorId === "YOU" ? 1 : 0;
                this.scene.effects.playHandcuffEffect(targetIdx);
            }

            if (action.item === ITEM_KEYS.KNIFE) {
                this.scene.effects.playKnifeEffect();
            }
        }

        // Check if new round started
        if (this.scene.state.shotgun.chamber.length > prevChamberLength) {
            this.scene.time.delayedCall(450, () => {
                this.scene.round.startTimeout();
            });
        }

        this.scene.render();

        if (action.type.startsWith("SHOOT")) {
            this.scene.targetedIndex = null;
            this.scene.isProcessing = true;
            this.scene.time.delayedCall(700, () => {
                this.scene.isProcessing = false;

                this.scene.gun.resetToNeutral();
                this.scene.ai.checkTurn();
                this.scene.players.updateAvatarStates(this.scene.state);
            });
        } else {
            // For non-shot actions (items), reset isProcessing after a short delay
            this.scene.time.delayedCall(80, () => {
                this.scene.isProcessing = false;
                this.scene.updateButtonStates();
                this.scene.ai.checkTurn();
                this.scene.players.updateAvatarStates(this.scene.state);
            });
        }
    }
}
