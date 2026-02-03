/**
 * ItemRenderer.js
 * Renders item icons for players with interactions
 */

import { ITEM_ASSET_MAP, COLORS } from "../LayoutConfig.js";

export class ItemRenderer {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Render items in a container
     */
    render(container, items, isInteractive, isDealer, ammoRevealPhase, betweenRounds) {
        container.removeAll(true);

        const itemSpacing = 36;
        const startX = -((Math.min(items.length, 6) - 1) * itemSpacing) / 2;

        items.forEach((item, i) => {
            const assetKey = ITEM_ASSET_MAP[item];
            const col = i % 6;
            const row = Math.floor(i / 6);
            const tx = startX + col * itemSpacing;
            const ty = row * 42;

            // Item Size Normalization
            const icon = this.scene.add.image(tx, ty, assetKey);

            const maxDim = 32;
            const scale = Math.min(maxDim / icon.width, maxDim / icon.height);
            icon.setScale(scale);

            if (icon.texture) {
                icon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }

            icon.setOrigin(0.5, 0.5);

            // Dealer items de-emphasized
            if (isDealer) {
                icon.setAlpha(0.5);
                icon.setTint(0xaaaaaa);
            }

            // Disabled during reveal/timeout phases
            if (ammoRevealPhase || betweenRounds) {
                icon.setTint(COLORS.TINT_DISABLED);
                icon.setAlpha(0.4);
            }

            const baseScale = icon.scaleX;

            if (isInteractive && !ammoRevealPhase && !betweenRounds) {
                icon.setInteractive({ useHandCursor: true });

                // Subtle hover effect
                icon.on("pointerover", () => {
                    this.scene.tweens.add({
                        targets: icon,
                        scale: baseScale * 1.12,
                        duration: 100
                    });
                });

                icon.on("pointerout", () => {
                    this.scene.tweens.add({
                        targets: icon,
                        scale: baseScale,
                        duration: 100
                    });
                });

                icon.on("pointerdown", () => this.scene.onItemAction(item));
            }

            container.add(icon);
        });
    }
}
