/**
 * Name Generator Utility
 * Generates random display names for anonymous players
 */

// Adjectives for player names
const ADJECTIVES = [
    'Lucky', 'Bold', 'Swift', 'Clever', 'Fierce',
    'Silent', 'Deadly', 'Quick', 'Sharp', 'Brave',
    'Cool', 'Wild', 'Dark', 'Ghost', 'Steel',
    'Iron', 'Golden', 'Silver', 'Crimson', 'Shadow'
];

// Nouns for player names
const NOUNS = [
    'Ace', 'Dealer', 'Shooter', 'Gambler', 'Drifter',
    'Outlaw', 'Ranger', 'Hunter', 'Wolf', 'Hawk',
    'Cobra', 'Viper', 'Tiger', 'Panther', 'Raven',
    'Blade', 'Bullet', 'Thunder', 'Storm', 'Fury'
];

/**
 * Generate a random display name
 * @returns {string} A random name like "BoldAce#7B2F"
 */
export function generateRandomName() {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `${adjective}${noun}#${suffix}`;
}

/**
 * Generate a short random ID
 * @param {number} length - Length of the ID
 * @returns {string} Random alphanumeric string
 */
export function generateId(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
