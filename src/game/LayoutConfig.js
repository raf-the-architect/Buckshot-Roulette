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
    CROSSED_REVOLVERS: "images/crossed-revolvers.png",

    // Avatars
    AVATAR_PLAYER: "images/avatars/avatar-player.png",
    AVATAR_PLAYER_ACTIVE: "images/avatars/avatar-active.png",
    AVATAR_PLAYER_DEAD: "images/avatars/avatar-dead.png",
    AVATAR_PLAYER_SELECTED: "images/avatars/avatar-selected.png",

    AVATAR_BOT: "images/avatars/avatar-bot.png",
    AVATAR_BOT_ACTIVE: "images/avatars/avatar-bot-active.png",
    AVATAR_BOT_DEAD: "images/avatars/avatar-bot-dead.png",
    AVATAR_BOT_SELECTED: "images/avatars/avatar-bot-selected.png",

    // UI Elements
    BTN_SHOOT_PLAYER_IDLE: "images/ui/shoot-player-idle.png",
    BTN_SHOOT_PLAYER_PRESSED: "images/ui/shoot-player-pressed.png",
    BTN_SHOOT_PLAYER_DISABLED: "images/ui/shoot-player-disabled.png",
    BTN_SHOOT_SELF_IDLE: "images/ui/shoot-self-idle.png",
    BTN_SHOOT_SELF_PRESSED: "images/ui/shoot-self-pressed.png",
    BTN_SHOOT_SELF_DISABLED: "images/ui/shoot-self-disabled.png",
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

export const AVATAR_KEYS = {
    PLAYER: "avatarPlayer",
    PLAYER_ACTIVE: "avatarPlayerActive",
    PLAYER_DEAD: "avatarPlayerDead",
    PLAYER_SELECTED: "avatarPlayerSelected",

    BOT: "avatarBot",
    BOT_ACTIVE: "avatarBotActive",
    BOT_DEAD: "avatarBotDead",
    BOT_SELECTED: "avatarBotSelected"
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
    TOP_ZONE: { y: 50 },
    BOT_ITEMS_ZONE: { y: 145 },
    GUN_ZONE: { y: 250 },
    AMMO_ZONE: { y: 320 },
    NEXT_AMMO_ZONE: { y: 265 },
    PLAYER_ITEMS_ZONE: { y: 440 },
    BTN_ZONE: { y: 580 },
    BOTTOM_ZONE: { y: 500 }
};

export const SCALE = {
    AVATAR: 0.25,
    GUN: 0.4,
    BUTTON: 0.5,
    AMMO: 0.20,
    HEART: 0.10,
    ITEM: 0.15
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
    PANEL_ROUNDED_RADIUS: 12,

    // Tints
    TINT_DISABLED: 0x555555,
    TINT_ACTIVE: 0x4a90d9,
    TINT_DANGER: 0xc62828
};

export const FONTS = {
    HEADLINE: {
        fontFamily: "Fredoka, Baloo 2, Trebuchet MS, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: COLORS.TEXT_PRIMARY
    },
    LABEL: {
        fontFamily: "Fredoka, Baloo 2, Trebuchet MS, sans-serif",
        fontSize: "14px",
        fontStyle: "600",
        color: COLORS.TEXT_PRIMARY
    },
    BODY: {
        fontFamily: "Baloo 2, Fredoka, Trebuchet MS, sans-serif",
        fontSize: "12px",
        color: COLORS.TEXT_SECONDARY
    },
    SMALL: {
        fontFamily: "Baloo 2, Fredoka, Trebuchet MS, sans-serif",
        fontSize: "10px",
        color: COLORS.TEXT_MUTED
    }
};
