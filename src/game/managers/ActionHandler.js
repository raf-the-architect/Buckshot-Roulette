/**
 * ActionHandler.js
 * Handles action processing and action indicator display
 */

import { applyAction, ITEM_KEYS } from "../gameLogic.js";
import { ITEM_ASSET_MAP, SCALE } from "../LayoutConfig.js";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ActionHandler");
const SHOT_RECOVERY_DELAY_MS = 1320;

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
            const icon = this.scene.imageService.createImage(0, y, iconKey, {
                scale: scale.ITEM * 1.8
            });
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

        if (isShot) {
            const lockTargetIndex = this.resolveTargetIndex(action, actorId);
            const targetPlayer = this.scene.state.players[lockTargetIndex];
            const targetUserId = targetPlayer?.userId || targetPlayer?.id || null;
            const actorIndex = actorId === "YOU" ? 0 : 1;
            const actorPlayer = this.scene.state.players[actorIndex];
            const actorUserId = actorPlayer?.userId || actorPlayer?.id || null;
            this.scene.lockTargetForAction?.(targetUserId, "shoot", actorUserId);
        }

        this.scene.players.updateAvatarStates(this.scene.state, this.scene.targetedIndex, null);

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
        const normalizedAction = this.normalizeAction(action, actorId);
        const isShot = action.type.startsWith("SHOOT");
        const isBeer = normalizedAction.type === "USE_ITEM" && normalizedAction.item === ITEM_KEYS.BEER;
        const prevHealth = this.scene.state.players.map(p => p.health);
        const actorIndex = actorId === "YOU" ? 0 : 1;
        const targetIndex = this.resolveTargetIndex(normalizedAction, actorId);
        const actorBefore = this.scene.state.players[actorIndex];
        const targetBefore = this.scene.state.players[targetIndex];
        const chamberBefore = {
            total: this.scene.state.shotgun.chamber.length,
            live: this.scene.state.shotgun.live,
            blank: this.scene.state.shotgun.blank,
            nextRound: this.scene.state.shotgun.chamber.length > 0
                ? (this.scene.state.shotgun.chamber[this.scene.state.shotgun.chamber.length - 1] ? "live" : "blank")
                : null
        };
        const roundBefore = this.scene.state.roundNumber;
        const turnBefore = this.scene.state.currentTurnIndex;

        this.scene.state = applyAction(this.scene.state, normalizedAction, this.scene.rng);

        const actorAfter = this.scene.state.players[actorIndex];
        const targetAfter = this.scene.state.players[targetIndex];
        const chamberAfter = {
            total: this.scene.state.shotgun.chamber.length,
            live: this.scene.state.shotgun.live,
            blank: this.scene.state.shotgun.blank,
            nextRound: this.scene.state.shotgun.chamber.length > 0
                ? (this.scene.state.shotgun.chamber[this.scene.state.shotgun.chamber.length - 1] ? "live" : "blank")
                : null
        };
        const revealedRound = this.scene.state.shotgun.nextRoundRevealed
            ? chamberAfter.nextRound
            : null;
        const turnAfter = this.scene.state.currentTurnIndex;
        const roundAfter = this.scene.state.roundNumber;

        if (normalizedAction.type === "USE_ITEM") {
            logger.info("item_used", {
                actorId,
                item: normalizedAction.item,
                targetId: normalizedAction.targetId || null,
                actorHealthBefore: actorBefore?.health,
                actorHealthAfter: actorAfter?.health,
                targetHealthBefore: targetBefore?.health,
                targetHealthAfter: targetAfter?.health,
                chamberBefore,
                chamberAfter,
                revealedRound,
                turnBefore,
                turnAfter,
                roundBefore,
                roundAfter
            });
        } else {
            const targetStr = normalizedAction.type === "SHOOT_PLAYER" ? (actorId === "YOU" ? "BOT" : "YOU") : actorId;
            logger.info("shot_fired", {
                actorId,
                target: targetStr,
                shotType: normalizedAction.type,
                roundType: wasLive ? "live" : "blank",
                actorHealthBefore: actorBefore?.health,
                actorHealthAfter: actorAfter?.health,
                targetHealthBefore: targetBefore?.health,
                targetHealthAfter: targetAfter?.health,
                chamberBefore,
                chamberAfter,
                turnBefore,
                turnAfter,
                roundBefore,
                roundAfter
            });
        }

        if (isShot) {
            this.scene.firedShots.push({ wasLive });

            logger.info("shot_result", {
                wasLive,
                actorId,
                targetId: normalizedAction.targetId || null,
                chamberAfter,
                roundAfter,
                turnAfter
            });

            this.scene.nextAmmoRevealed = null;
            this.scene.gun.hideNextAmmo();

            if (wasLive) {
                this.scene.sound.play("sndGunshot");
            } else {
                this.scene.sound.play("sndDryFire");
            }
            this.scene.effects.playShootEffect(wasLive, normalizedAction);
            this.scene.effects.playGunImpactEffect({
                targetIndex,
                wasLive,
                shouldDisplay: true
            });

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

        if (normalizedAction.type === "USE_ITEM") {
            this.scene.effects.playItemEffect(normalizedAction.item, actorId);

            if (isBeer && prevChamberLength > 0) {
                this.scene.firedShots.push({ wasLive });
                this.scene.effects.playBeerEffect(wasLive);
            }

            if (normalizedAction.item === ITEM_KEYS.MAGNIFYING_GLASS) {
                if (actorId === "YOU") {
                    this.scene.round.revealNextAmmo();
                }
            }

            if (normalizedAction.item === ITEM_KEYS.CIGARETTE) {
                const idx = actorId === "YOU" ? 0 : 1;
                this.scene.effects.playHealEffect(idx);
            }

            if (normalizedAction.item === ITEM_KEYS.HANDCUFFS) {
                const targetIdx = this.resolveTargetIndex(normalizedAction, actorId);
                this.scene.effects.playHandcuffEffect(targetIdx);
            }

            if (normalizedAction.item === ITEM_KEYS.KNIFE) {
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

        if (normalizedAction.type.startsWith("SHOOT")) {
            this.scene.isProcessing = true;
            this.scene.time.delayedCall(SHOT_RECOVERY_DELAY_MS, () => {
                this.scene.targetedIndex = null;
                this.scene.clearTargetSelection?.();
                this.scene.clearLockedTarget?.();
                this.scene.isProcessing = false;

                this.scene.gun.resetToNeutral();
                this.scene.ai.checkTurn();
                this.scene.updateButtonStates();
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

    normalizeAction(action, actorId) {
        const normalized = { ...action };

        if (normalized.type === "USE_ITEM" && normalized.item) {
            normalized.item = this.scene.normalizeItemKey?.(normalized.item) || normalized.item;

            if (normalized.item === ITEM_KEYS.HANDCUFFS && !normalized.targetId) {
                const targetPlayer = this.scene.state.players.find(p => {
                    const playerId = p.userId || p.id;
                    if (!p.alive) return false;
                    return playerId !== actorId && p.id !== actorId;
                });

                if (targetPlayer) {
                    normalized.targetId = targetPlayer.userId || targetPlayer.id;
                }
            }
        }

        return normalized;
    }

    resolveTargetIndex(action, actorId) {
        if (!action?.targetId) return actorId === "YOU" ? 1 : 0;

        const index = this.scene.state.players.findIndex(p =>
            p.id === action.targetId || p.userId === action.targetId
        );

        if (index === -1) return actorId === "YOU" ? 1 : 0;
        return index;
    }
}
