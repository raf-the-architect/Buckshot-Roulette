/**
 * RoundManager.js
 * Manages round flow, ammo reveal, and reload timeouts
 */

export class RoundManager {
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
     * Start ammo reveal phase at the beginning of a round
     */
    startAmmoReveal() {
        const scene = this.scene;

        scene.ammoRevealPhase = true;
        scene.firedShots = [];
        scene.roundStartLive = scene.state.shotgun.live;
        scene.roundStartBlank = scene.state.shotgun.blank;
        scene.roundStartTotal = scene.state.shotgun.chamber.length;
        scene.nextAmmoRevealed = null;
        scene.gun.hideNextAmmo();
        scene.gun.resetAngles();

        console.log(`[STATE] New Round Started. Chamber: ${scene.roundStartLive} Live, ${scene.roundStartBlank} Blank`);

        // Play spin sound
        scene.sound.play("sndSpin");

        scene.render();

        // Disable all actions for 3 seconds
        scene.time.delayedCall(3000, () => {
            // Soft exit for reveal phase
            scene.tweens.add({
                targets: scene.ammo.getContainer(),
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    scene.ammoRevealPhase = false;
                    scene.render();
                    scene.ammo.setAlpha(1);
                    scene.ai.checkTurn();
                    scene.players.updateAvatarStates(scene.state);
                }
            });
        });
    }

    /**
     * Start round timeout (reload animation)
     */
    startTimeout() {
        const scene = this.scene;
        const layout = this.getLayout();

        scene.betweenRounds = true;
        scene.render();

        scene.sound.play("sndReload");

        const reloadContainer = scene.add.container(layout.CENTER_X, layout.HEIGHT / 2);

        scene.tweens.add({
            targets: reloadContainer,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.9, to: 1 },
            duration: 200,
            ease: 'Back.easeOut'
        });

        scene.time.delayedCall(3000, () => {
            scene.tweens.add({
                targets: reloadContainer,
                alpha: 0,
                scale: 0.9,
                duration: 200,
                onComplete: () => reloadContainer.destroy()
            });
            scene.betweenRounds = false;
            this.startAmmoReveal();
        });
    }

    /**
     * Reveal next ammo (magnifying glass)
     */
    revealNextAmmo() {
        const chamber = this.scene.state.shotgun.chamber;
        if (chamber.length === 0) return;

        const nextRound = chamber[chamber.length - 1];
        this.scene.nextAmmoRevealed = nextRound;

        this.scene.gun.revealNextAmmo(nextRound);
    }
}
