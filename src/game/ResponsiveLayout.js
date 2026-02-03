/**
 * ResponsiveLayout.js
 * Dynamic layout calculations based on screen size
 */

// Base design dimensions (reference size)
const BASE_WIDTH = 360;
const BASE_HEIGHT = 640;

/**
 * Get responsive layout values based on current scene dimensions
 */
export function getLayout(scene) {
    const width = scene.scale.width;
    const height = scene.scale.height;

    return {
        WIDTH: width,
        HEIGHT: height,
        CENTER_X: width / 2,
        TOP_ZONE: { y: height * 0.078 },        // ~50/640
        BOT_ITEMS_ZONE: { y: height * 0.227 },  // ~145/640
        GUN_ZONE: { y: height * 0.391 },        // ~250/640
        AMMO_ZONE: { y: height * 0.5 },         // ~320/640
        NEXT_AMMO_ZONE: { y: height * 0.414 },  // ~265/640
        PLAYER_ITEMS_ZONE: { y: height * 0.688 }, // ~440/640
        BTN_ZONE: { y: height * 0.906 },        // ~580/640
        BOTTOM_ZONE: { y: height * 0.781 }      // ~500/640
    };
}

/**
 * Get responsive scale values based on current scene dimensions
 */
export function getScale(scene) {
    const width = scene.scale.width;
    const scaleFactor = width / BASE_WIDTH;

    // Clamp scale factor to reasonable bounds
    const clampedFactor = Math.min(Math.max(scaleFactor, 0.75), 1.5);

    return {
        AVATAR: 0.25 * clampedFactor,
        GUN: 0.4 * clampedFactor,
        BUTTON: 0.5 * clampedFactor,
        AMMO: 0.20 * clampedFactor,
        HEART: 0.10 * clampedFactor,
        ITEM: 0.15 * clampedFactor
    };
}

/**
 * Static layout for backward compatibility (used during preload before scale is available)
 */
export const STATIC_LAYOUT = {
    WIDTH: BASE_WIDTH,
    HEIGHT: BASE_HEIGHT,
    CENTER_X: BASE_WIDTH / 2,
    TOP_ZONE: { y: 50 },
    BOT_ITEMS_ZONE: { y: 145 },
    GUN_ZONE: { y: 250 },
    AMMO_ZONE: { y: 320 },
    NEXT_AMMO_ZONE: { y: 265 },
    PLAYER_ITEMS_ZONE: { y: 440 },
    BTN_ZONE: { y: 580 },
    BOTTOM_ZONE: { y: 500 }
};

export const STATIC_SCALE = {
    AVATAR: 0.25,
    GUN: 0.4,
    BUTTON: 0.5,
    AMMO: 0.20,
    HEART: 0.10,
    ITEM: 0.15
};
