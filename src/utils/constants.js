/**
 * Game Constants
 * Shared constants for the multiplayer game
 */

// Game Items
export const ITEMS = {
    KNIFE: 'knife',
    MAGNIFYING_GLASS: 'magnifying_glass',
    HANDCUFFS: 'handcuffs',
    BEER: 'beer',
    CIGARETTE: 'cigarette'
};

// Item display info
export const ITEM_INFO = {
    [ITEMS.KNIFE]: { emoji: '🔪', name: 'Knife', description: 'Double damage for next shot' },
    [ITEMS.MAGNIFYING_GLASS]: { emoji: '🔍', name: 'Magnifying Glass', description: 'See current round' },
    [ITEMS.HANDCUFFS]: { emoji: 'chains', name: 'Handcuffs', description: 'Skip opponent\'s next turn' },
    [ITEMS.BEER]: { emoji: '🍺', name: 'Beer', description: 'Eject current round' },
    [ITEMS.CIGARETTE]: { emoji: '🚬', name: 'Cigarette', description: 'Restore 1 health' }
};

// Room statuses
export const ROOM_STATUS = {
    WAITING: 'waiting',
    STARTING: 'starting',
    PLAYING: 'playing',
    ENDED: 'ended'
};

// Game phases
export const GAME_PHASE = {
    SETUP: 'setup',
    ITEM: 'item',
    AIM: 'aim',
    SHOOT: 'shoot',
    RESOLUTION: 'resolution',
    ROUND_END: 'round_end'
};

// Player status
export const PLAYER_STATUS = {
    ACTIVE: 'active',
    DISCONNECTED: 'disconnected',
    KICKED: 'kicked'
};

// Turn time limit in seconds
export const TURN_TIME_LIMIT = 0;

// Max players
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;

// Max items per player
export const MAX_ITEMS = 8;
