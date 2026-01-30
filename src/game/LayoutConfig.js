/**
 * LayoutConfig.js
 * Centralized layout constants, colors, fonts, and asset mappings
 */

import { ITEM_KEYS } from "./gameLogic.js";

// ============================================================================
// ASSET KEYS - Organized by category
// ============================================================================
export const ASSETS = {
    // Background & Core
    BG: "images/background.png",
    GUN: "images/gun.png",

    // Avatars
    AVATAR: "images/avatars/avatar.png",
    AVATAR_ACTIVE: "images/avatars/avatar-active.png",
    AVATAR_DEAD: "images/avatars/avatar-dead.png",

    // UI Elements
    BTN_SHOOT_PLAYER: "images/ui/shoot-player_btn.png",
    BTN_SHOOT_SELF: "images/ui/shoot-self_btn.png",
    HEART_FULL: "images/ui/live-filled_icon.png",
    HEART_EMPTY: "images/ui/live-empty_icon.png",

    // Ammo
    AMMO_FILLED: "images/ammo/ammo_filled.png",
    AMMO_EMPTY: "images/ammo/ammo_empty.png",
    AMMO_UNKNOWN: "images/ammo/ammo_unknown.png",

    // Items
    ITEM_KNIFE: "images/items/knife_item.png",
    ITEM_MAGNIFY: "images/items/magnifyin-glass_item.png",
    ITEM_HANDCUFFS: "images/items/handcuffs_item.png",
    ITEM_BEER: "images/items/beer_item.png",
    ITEM_CIGARETTE: "images/items/sigarette_item.png"
};

export const SOUNDS = {
    REVOLVER_SPIN: "sounds/revolver-spin.mp3",
    RELOAD: "sounds/clean-revolver-reload.mp3",
    GUNSHOT: "sounds/single-pistol-gunshot.mp3",
    DRY_FIRE: "sounds/double-dry-fire.mp3",
    BG_MUSIC: "sounds/bg-music.mp3"
};

export const ITEM_ASSET_MAP = {
    [ITEM_KEYS.KNIFE]: "itemKnife",
    [ITEM_KEYS.MAGNIFYING_GLASS]: "itemMagnify",
    [ITEM_KEYS.HANDCUFFS]: "itemHandcuffs",
    [ITEM_KEYS.BEER]: "itemBeer",
    [ITEM_KEYS.CIGARETTE]: "itemCigarette"
};

// ============================================================================
// LAYOUT
// ============================================================================
export const LAYOUT = {
    WIDTH: 360,
    HEIGHT: 640,
    CENTER_X: 180,
    TOP_ZONE: { y: 70 },
    BOT_ITEMS_ZONE: { y: 135 },
    GUN_ZONE: { y: 210 },
    AMMO_ZONE: { y: 290 },
    NEXT_AMMO_ZONE: { y: 245 },
    BTN_ZONE: { y: 380 },
    PLAYER_ITEMS_ZONE: { y: 470 },
    BOTTOM_ZONE: { y: 560 }
};

export const SCALE = {
    AVATAR: 0.22,
    GUN: 0.4,
    BUTTON_PRIMARY: 0.55,
    BUTTON_SECONDARY: 0.45,
    AMMO: 0.25,
    HEART: 0.28,
    ITEM: 0.16
};

// ============================================================================
// STYLE SYSTEM - Controlled Color Palette & Typography
// ============================================================================
export const COLORS = {
    // Primary palette
    PRIMARY: "#4a90d9",
    DANGER: "#c62828",
    SUCCESS: "#43a047",
    WARNING: "#f9a825",

    // Neutral palette
    TEXT_PRIMARY: "#ffffff",
    TEXT_SECONDARY: "#a0a0a0",
    TEXT_MUTED: "#666666",

    // UI elements
    PANEL_BG: 0x1a1a1a,
    PANEL_BORDER: 0x333333,

    // Tints
    TINT_DISABLED: 0x555555,
    TINT_ACTIVE: 0x4a90d9,
    TINT_DANGER: 0xc62828
};

export const FONTS = {
    HEADLINE: {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: COLORS.TEXT_PRIMARY
    },
    LABEL: {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "600",
        color: COLORS.TEXT_PRIMARY
    },
    BODY: {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "12px",
        color: COLORS.TEXT_SECONDARY
    },
    SMALL: {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "10px",
        color: COLORS.TEXT_MUTED
    }
};
