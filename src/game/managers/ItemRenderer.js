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

        const groupedItems = this.groupItems(items || []);
        const itemSpacing = 36;
        const startX = -((Math.min(groupedItems.length, 6) - 1) * itemSpacing) / 2;

        groupedItems.forEach((entry, i) => {
            const item = entry.item;
            const count = entry.count;
            const assetKey = ITEM_ASSET_MAP[item];
            if (!assetKey) return;
            const col = i % 6;
            const row = Math.floor(i / 6);
            const tx = startX + col * itemSpacing;
            const ty = row * 42;

            const maxDim = 38;
            const icon = this.scene.imageService.createImage(tx, ty, assetKey);
            const scale = this.scene.imageService.setScaleFromMaxDimension(icon, maxDim, { allowUpscale: true });

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

            if (count > 1) {
                const badgeOffsetX = (icon.displayWidth * 0.34);
                const badgeOffsetY = -(icon.displayHeight * 0.34);
                const badgeCircle = this.scene.add.circle(
                    tx + badgeOffsetX,
                    ty + badgeOffsetY,
                    9,
                    0xe53935,
                    0.95
                );
                const badgeText = this.scene.add.text(
                    tx + badgeOffsetX,
                    ty + badgeOffsetY,
                    String(count),
                    {
                        fontFamily: "Arial, sans-serif",
                        fontSize: "10px",
                        fontStyle: "bold",
                        color: "#ffffff"
                    }
                ).setOrigin(0.5);

                if (isDealer || ammoRevealPhase || betweenRounds) {
                    badgeCircle.setAlpha(0.75);
                    badgeText.setAlpha(0.85);
                }

                container.add(badgeCircle);
                container.add(badgeText);
            }
        });
    }

    /**
     * Collapse duplicate items while preserving first-seen order.
     */
    groupItems(items) {
        const counts = new Map();
        const order = [];

        items.forEach((item) => {
            if (!counts.has(item)) {
                counts.set(item, 0);
                order.push(item);
            }
            counts.set(item, counts.get(item) + 1);
        });

        return order.map((item) => ({
            item,
            count: counts.get(item) || 0
        }));
    }
}
