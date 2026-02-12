/**
 * Game Logic for Bang or Blank
 * Supports 2-8 player multiplayer with network play
 */

// =========================================================================
// CONSTANTS
// =========================================================================

export const ITEM_KEYS = {
  KNIFE: "KNIFE",
  MAGNIFYING_GLASS: "MAGNIFYING_GLASS",
  HANDCUFFS: "HANDCUFFS",
  BEER: "BEER",
  CIGARETTE: "CIGARETTE"
};

export const ITEM_EMOJIS = {
  [ITEM_KEYS.KNIFE]: "🔪",
  [ITEM_KEYS.MAGNIFYING_GLASS]: "🔍",
  [ITEM_KEYS.HANDCUFFS]: "⛓",
  [ITEM_KEYS.BEER]: "🍺",
  [ITEM_KEYS.CIGARETTE]: "🚬"
};

// Item descriptions for UI
export const ITEM_DESCRIPTIONS = {
  [ITEM_KEYS.KNIFE]: "Double damage for next shot",
  [ITEM_KEYS.MAGNIFYING_GLASS]: "See current round",
  [ITEM_KEYS.HANDCUFFS]: "Skip target's next turn",
  [ITEM_KEYS.BEER]: "Eject current round",
  [ITEM_KEYS.CIGARETTE]: "Restore 1 health"
};

// Items that require a target selection
export const ITEMS_REQUIRING_TARGET = [
  ITEM_KEYS.HANDCUFFS
];

// Max items per player
export const MAX_ITEMS = 8;

// Min/Max players
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

// =========================================================================
// STATE CREATION
// =========================================================================

/**
 * Create initial game state for single-player (legacy support)
 * @returns {Object} Initial game state
 */
export function createInitialState() {
  return createMultiplayerState([
    { id: "YOU", displayName: "Player" },
    { id: "BOT", displayName: "Dealer" }
  ]);
}

/**
 * Create initial game state for multiplayer
 * @param {Array} players - Array of player objects with id and displayName
 * @param {Object} options - Game options
 * @returns {Object} Initial game state
 */
export function createMultiplayerState(players, options = {}) {
  const playerCount = players.length;
  
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Player count must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
  }
  
  const initialHealth = calculateInitialHealth(playerCount);
  
  return {
    // Turn management
    currentTurnIndex: 0,
    turnNumber: 1,  // For intent validation
    turnLock: false, // Prevent concurrent actions
    turnLockHolder: null, // ID of player who holds the lock
    
    // Shotgun state
    shotgun: { 
      chamber: [], 
      damage: 1,
      live: 0,
      blank: 0,
      nextRoundRevealed: false,
      revealedRoundInfo: null, // For burner phone reveals
      isInverted: false // Track inverter effect
    },
    
    // Players
    players: players.map((p, index) => ({
      id: p.id || p.oderId || `player_${index}`,
      oderId: p.userId || p.id || `player_${index}`,
      displayName: p.displayName || `Player ${index + 1}`,
      health: initialHealth,
      maxHealth: initialHealth,
      items: [],
      turnsWaiting: 0,
      alive: true,
      isConnected: true,
      lastActionTime: Date.now()
    })),
    
    // Game meta
    gameOver: false,
    winnerId: null,
    roundNumber: 0,
    initialHealth: initialHealth,
    
    // Logs
    logs: ["🎮 Game Started!"],
    
    // Options
    options: {
      useExpandedItems: options.useExpandedItems ?? true,
      turnTimeLimit: options.turnTimeLimit ?? 30,
      allowReconnect: options.allowReconnect ?? true
    }
  };
}

/**
 * Calculate initial health based on player count
 * More players = less health to keep games reasonable length
 */
export function calculateInitialHealth(playerCount) {
  if (playerCount <= 2) return 4;
  if (playerCount <= 4) return 3;
  return 2;
}

// =========================================================================
// TURN MANAGEMENT
// =========================================================================

/**
 * Acquire turn lock for network play (prevents race conditions)
 * @param {Object} state - Game state
 * @param {string} playerId - Player requesting lock
 * @param {number} turnNumber - Expected turn number for validation
 * @returns {Object} Result with success status and updated state
 */
export function acquireTurnLock(state, playerId, turnNumber) {
  const s = structuredClone(state);
  
  // Validate it's this player's turn
  const currentPlayer = s.players[s.currentTurnIndex];
  if (currentPlayer.id !== playerId && currentPlayer.userId !== playerId) {
    return { success: false, reason: "NOT_YOUR_TURN", state: s };
  }
  
  // Validate turn number matches (prevents stale actions)
  if (turnNumber !== s.turnNumber) {
    return { success: false, reason: "STALE_TURN", state: s };
  }
  
  // Check if already locked
  if (s.turnLock) {
    if (s.turnLockHolder === playerId) {
      return { success: true, state: s }; // Already holds lock
    }
    return { success: false, reason: "LOCK_HELD", state: s };
  }
  
  // Acquire lock
  s.turnLock = true;
  s.turnLockHolder = playerId;
  
  return { success: true, state: s };
}

/**
 * Release turn lock
 * @param {Object} state - Game state
 * @param {string} playerId - Player releasing lock
 * @returns {Object} Updated state
 */
export function releaseTurnLock(state, playerId) {
  const s = structuredClone(state);
  
  if (s.turnLockHolder === playerId) {
    s.turnLock = false;
    s.turnLockHolder = null;
  }
  
  return s;
}

/**
 * Validate an action intent before execution
 * @param {Object} state - Game state
 * @param {Object} action - Proposed action
 * @param {string} playerId - Player attempting action
 * @returns {Object} Validation result
 */
export function validateActionIntent(state, action, playerId) {
  if (state.gameOver) {
    return { valid: false, reason: "GAME_OVER" };
  }
  
  const currentPlayer = state.players[state.currentTurnIndex];
  const isCurrentPlayer = currentPlayer.id === playerId || currentPlayer.userId === playerId;
  
  if (!isCurrentPlayer) {
    return { valid: false, reason: "NOT_YOUR_TURN" };
  }
  
  if (!currentPlayer.alive) {
    return { valid: false, reason: "PLAYER_DEAD" };
  }
  
  // Validate action-specific requirements
  if (action.type === "USE_ITEM") {
    if (!currentPlayer.items.includes(action.item)) {
      return { valid: false, reason: "ITEM_NOT_OWNED" };
    }
    
    // Check if item requires target
    if (ITEMS_REQUIRING_TARGET.includes(action.item) && !action.targetId) {
      return { valid: false, reason: "TARGET_REQUIRED" };
    }
  }
  
  if (action.type === "SHOOT_OTHER") {
    const target = state.players.find(p => p.id === action.targetId || p.userId === action.targetId);
    if (!target) {
      return { valid: false, reason: "TARGET_NOT_FOUND" };
    }
    if (!target.alive) {
      return { valid: false, reason: "TARGET_DEAD" };
    }
  }
  
  return { valid: true };
}

// =========================================================================
// SHOTGUN MANAGEMENT
// =========================================================================

export function refillShotgun(state, rng) {
  const nextRoundNumber = (state.roundNumber || 0) + 1;

  // Align offline round profile with multiplayer pacing while keeping random chamber order.
  const live = nextRoundNumber === 1
    ? 2
    : Math.min(nextRoundNumber + 1, 4);
  const blank = nextRoundNumber === 1
    ? 4
    : Math.min(nextRoundNumber + 2, 5);
  
  let rounds = [];
  for (let i = 0; i < live; i++) rounds.push(true);
  for (let i = 0; i < blank; i++) rounds.push(false);
  
  // Shuffle using RNG (Fisher-Yates)
  for (let i = rounds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
  }
  
  state.shotgun.chamber = rounds;
  state.shotgun.live = live;
  state.shotgun.blank = blank;
  state.shotgun.nextRoundRevealed = false;
  state.shotgun.revealedRoundInfo = null;
  state.shotgun.isInverted = false;
  state.roundNumber = nextRoundNumber;
  
  state.logs.push(`🎰 Round ${state.roundNumber}: Loaded ${live} 🔴 Live, ${blank} ⚪ Blank.`);
}

export function giveItems(state, rng) {
  const itemPool = [ITEM_KEYS.KNIFE, ITEM_KEYS.MAGNIFYING_GLASS, ITEM_KEYS.HANDCUFFS, ITEM_KEYS.BEER, ITEM_KEYS.CIGARETTE];
  
  const playerCount = state.players.filter(p => p.alive).length;
  const itemsPerPlayer = playerCount <= 2 ? 3 : (playerCount <= 4 ? 2 : 2);
  
  state.players.forEach(p => {
    if (!p.alive) return;
    const count = Math.floor(rng.random() * itemsPerPlayer) + 1;
    for (let i = 0; i < count; i++) {
      if (p.items.length < MAX_ITEMS) {
        const item = itemPool[Math.floor(rng.random() * itemPool.length)];
        p.items.push(item);
      }
    }
  });
  
  state.logs.push("🎁 Items distributed!");
}

// =========================================================================
// ACTION APPLICATION
// =========================================================================

export function applyAction(state, action, rng) {
  const s = structuredClone(state);
  if (s.gameOver) return s;
  
  const actor = s.players[s.currentTurnIndex];
  if (!actor.alive) return s;
  
  // Update last action time
  actor.lastActionTime = Date.now();

  if (action.type === "USE_ITEM") {
    return applyItemUse(s, action, actor, rng);
  }

  if (action.type.startsWith("SHOOT")) {
    return applyShoot(s, action, actor, rng);
  }

  return s;
}

/**
 * Apply item use action
 */
function applyItemUse(s, action, actor, rng) {
  const idx = actor.items.indexOf(action.item);
  if (idx === -1) return s;
  actor.items.splice(idx, 1);

  const itemName = action.item;
  const emoji = ITEM_EMOJIS[itemName];
  
  switch (itemName) {
    case ITEM_KEYS.KNIFE:
      s.shotgun.damage = 2;
      s.logs.push(`${actor.displayName || actor.id} used ${emoji} KNIFE. Damage x2!`);
      break;
      
    case ITEM_KEYS.CIGARETTE:
      if (actor.health < actor.maxHealth) {
        actor.health++;
        s.logs.push(`${actor.displayName || actor.id} used ${emoji} CIGARETTE. +1 Health.`);
      } else {
        s.logs.push(`${actor.displayName || actor.id} used ${emoji} CIGARETTE. Already at max health!`);
      }
      break;
      
    case ITEM_KEYS.BEER:
      if (s.shotgun.chamber.length > 0) {
        const removed = s.shotgun.chamber.pop();
        if (removed) s.shotgun.live--;
        else s.shotgun.blank--;
        s.logs.push(`${actor.displayName || actor.id} used ${emoji} BEER. Racked a ${removed ? "🔴 LIVE" : "⚪ BLANK"} round.`);
      }
      break;
      
    case ITEM_KEYS.MAGNIFYING_GLASS:
      if (s.shotgun.chamber.length > 0) {
        s.shotgun.nextRoundRevealed = true;
        const next = s.shotgun.chamber[s.shotgun.chamber.length - 1];
        // Only the actor sees this in multiplayer (handled by client)
        s.logs.push(`${actor.displayName || actor.id} used ${emoji} GLASS. Peeked at the chamber...`);
      }
      break;
      
    case ITEM_KEYS.HANDCUFFS: {
      const target = findTargetPlayer(s, action.targetId);
      if (target && target.alive) {
        target.turnsWaiting++;
        s.logs.push(`${actor.displayName || actor.id} used ${emoji} HANDCUFFS on ${target.displayName || target.id}!`);
      }
      break;
    }
  }
  
  // Check if chamber is empty
  if (s.shotgun.chamber.length === 0) {
    finalizeTurn(s, false, rng);
  }
  
  return s;
}

/**
 * Apply shoot action
 */
function applyShoot(s, action, actor, rng) {
  const isSelfShot = action.type === "SHOOT_SELF";
  const target = isSelfShot ? actor : findTargetPlayer(s, action.targetId);
  
  if (!target) return s;
  
  const round = s.shotgun.chamber.pop();
  const isLive = !!round;
  
  if (isLive) s.shotgun.live--;
  else s.shotgun.blank--;
  
  // Reset reveal states
  s.shotgun.nextRoundRevealed = false;
  s.shotgun.revealedRoundInfo = null;
  s.shotgun.isInverted = false;

  const targetName = target.displayName || target.id;
  const actorName = actor.displayName || actor.id;
  
  if (isLive) {
    const damage = s.shotgun.damage;
    target.health -= damage;
    
    if (isSelfShot) {
      s.logs.push(`💥 BOOM! ${actorName} shot themselves for ${damage} damage!`);
    } else {
      s.logs.push(`💥 BOOM! ${actorName} shot ${targetName} for ${damage} damage!`);
    }
    
    if (target.health <= 0) {
      target.alive = false;
      target.health = 0;
      s.logs.push(`☠️ ${targetName} has been eliminated!`);
      checkGameOver(s);
    }
  } else {
    if (isSelfShot) {
      s.logs.push(`*click* ${actorName} shot themselves with a BLANK.`);
    } else {
      s.logs.push(`*click* ${actorName} shot ${targetName}. It was a BLANK.`);
    }
  }

  s.shotgun.damage = 1; // Reset knife

  // Determine next turn
  let switchTurn = true;
  if (isSelfShot && !isLive) {
    switchTurn = false;
    s.logs.push(`🎯 ${actorName} gets an extra turn!`);
  }

  finalizeTurn(s, switchTurn, rng);
  
  return s;
}

/**
 * Find a player by ID or userId
 */
function findTargetPlayer(s, targetId) {
  return s.players.find(p => 
    p.id === targetId || 
    p.userId === targetId
  );
}

// =========================================================================
// GAME FLOW HELPERS
// =========================================================================

function getNextAliveOpponent(s) {
  let idx = s.currentTurnIndex;
  for (let i = 0; i < s.players.length; i++) {
    let checkIdx = (idx + i + 1) % s.players.length;
    if (s.players[checkIdx].alive) return s.players[checkIdx];
  }
  return null;
}

function checkGameOver(s) {
  const alivePlayers = s.players.filter(p => p.alive);
  if (alivePlayers.length <= 1) {
    s.gameOver = true;
    if (alivePlayers.length === 1) {
      s.winnerId = alivePlayers[0].id;
      s.logs.push(`🏆 ${alivePlayers[0].displayName || alivePlayers[0].id} WINS!`);
    } else {
      s.logs.push("💀 DRAW! No one survived.");
    }
  }
}

function finalizeTurn(s, switchTurn, rng) {
  // Release any turn lock
  s.turnLock = false;
  s.turnLockHolder = null;
  
  if (s.shotgun.chamber.length === 0 && !s.gameOver) {
    refillShotgun(s, rng);
    giveItems(s, rng);
  }

  if (switchTurn) {
    nextTurn(s);
  }
}

function nextTurn(s) {
  const startIdx = s.currentTurnIndex;
  let attempts = 0;
  
  do {
    s.currentTurnIndex = (s.currentTurnIndex + 1) % s.players.length;
    const p = s.players[s.currentTurnIndex];

    if (!p.alive) {
      attempts++;
      continue;
    }

    if (p.turnsWaiting > 0) {
      p.turnsWaiting--;
      s.logs.push(`⛓️ ${p.displayName || p.id} is handcuffed! Turn skipped.`);
      attempts++;
      continue;
    }
    
    // Found valid player
    s.turnNumber++;
    break;
    
  } while (attempts < s.players.length * 2);
}

// =========================================================================
// RECONNECTION SUPPORT
// =========================================================================

/**
 * Handle player reconnection
 * @param {Object} state - Game state
 * @param {string} playerId - Reconnecting player ID
 * @returns {Object} Updated state
 */
export function handlePlayerReconnect(state, playerId) {
  const s = structuredClone(state);
  
  const player = s.players.find(p => p.id === playerId || p.userId === playerId);
  if (player) {
    player.isConnected = true;
    player.lastActionTime = Date.now();
    s.logs.push(`🔄 ${player.displayName || player.id} reconnected.`);
  }
  
  return s;
}

/**
 * Handle player disconnection
 * @param {Object} state - Game state
 * @param {string} playerId - Disconnecting player ID
 * @returns {Object} Updated state
 */
export function handlePlayerDisconnect(state, playerId) {
  const s = structuredClone(state);
  
  const player = s.players.find(p => p.id === playerId || p.userId === playerId);
  if (player) {
    player.isConnected = false;
    s.logs.push(`⚠️ ${player.displayName || player.id} disconnected.`);
  }
  
  return s;
}

/**
 * Force skip turn for AFK player
 * @param {Object} state - Game state
 * @param {Object} rng - Random number generator
 * @returns {Object} Updated state
 */
export function forceSkipTurn(state, rng) {
  const s = structuredClone(state);
  
  const currentPlayer = s.players[s.currentTurnIndex];
  s.logs.push(`⏰ ${currentPlayer.displayName || currentPlayer.id} timed out!`);
  
  // Auto-shoot self with current round as penalty
  const round = s.shotgun.chamber.pop();
  if (round !== undefined) {
    const isLive = !!round;
    if (isLive) {
      s.shotgun.live--;
      currentPlayer.health--;
      s.logs.push(`💥 Penalty shot! ${currentPlayer.displayName || currentPlayer.id} took 1 damage.`);
      if (currentPlayer.health <= 0) {
        currentPlayer.alive = false;
        currentPlayer.health = 0;
        checkGameOver(s);
      }
    } else {
      s.shotgun.blank--;
    }
  }
  
  finalizeTurn(s, true, rng);
  
  return s;
}

// =========================================================================
// UTILITY EXPORTS
// =========================================================================

export { getNextAliveOpponent, checkGameOver };
