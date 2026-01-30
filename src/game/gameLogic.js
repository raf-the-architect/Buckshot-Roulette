
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

export function createInitialState() {
  return {
    currentTurnIndex: 0,
    shotgun: { 
      chamber: [], 
      damage: 1,
      live: 0,
      blank: 0,
      nextRoundRevealed: false 
    },
    players: [
      { id: "YOU", health: 4, items: [], turnsWaiting: 0, alive: true },
      { id: "BOT", health: 4, items: [], turnsWaiting: 0, alive: true }
    ],
    gameOver: false,
    roundNumber: 0,
    logs: ["Game Started!"]
  };
}

export function refillShotgun(state, rng) {
  const live = Math.floor(rng.random() * 3) + 1;
  const blank = Math.floor(rng.random() * 3) + 1;
  let rounds = [];
  for (let i = 0; i < live; i++) rounds.push(true);
  for (let i = 0; i < blank; i++) rounds.push(false);
  
  // Shuffle using RNG
  for (let i = rounds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
  }
  
  state.shotgun.chamber = rounds;
  state.shotgun.live = live;
  state.shotgun.blank = blank;
  state.roundNumber = (state.roundNumber || 0) + 1;
  state.logs.push(`Round ${state.roundNumber}: Loaded ${live} Live, ${blank} Blank.`);
}

export function giveItems(state, rng) {
  const itemPool = Object.values(ITEM_KEYS);
  state.players.forEach(p => {
    if (!p.alive) return;
    const count = Math.floor(rng.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
        // Python-like cap: 8 items
      if (p.items.length < 8) {
        const item = itemPool[Math.floor(rng.random() * itemPool.length)];
        p.items.push(item);
      }
    }
  });
}

export function applyAction(state, action, rng) {
  const s = structuredClone(state);
  if (s.gameOver) return s;
  
  const actor = s.players[s.currentTurnIndex];
  if (!actor.alive) return s;

  if (action.type === "USE_ITEM") {
    const idx = actor.items.indexOf(action.item);
    if (idx === -1) return s;
    actor.items.splice(idx, 1);

    const itemName = action.item;
    if (itemName === ITEM_KEYS.KNIFE) {
      s.shotgun.damage = 2;
      s.logs.push(`${actor.id} used ${ITEM_EMOJIS[itemName]} KNIFE. Damage x2!`);
    } else if (itemName === ITEM_KEYS.CIGARETTE) {
      actor.health++;
      s.logs.push(`${actor.id} used ${ITEM_EMOJIS[itemName]} CIGARETTE. +1 Health.`);
    } else if (itemName === ITEM_KEYS.BEER) {
      const removed = s.shotgun.chamber.pop();
      if (removed) s.shotgun.live--;
      else s.shotgun.blank--;
      s.logs.push(`${actor.id} used ${ITEM_EMOJIS[itemName]} BEER. Racked a ${removed ? "LIVE" : "BLANK"} round.`);
    } else if (itemName === ITEM_KEYS.MAGNIFYING_GLASS) {
      s.shotgun.nextRoundRevealed = true;
      const next = s.shotgun.chamber[s.shotgun.chamber.length - 1];
      s.logs.push(`${actor.id} used ${ITEM_EMOJIS[itemName]} GLASS. Next is ${next ? "LIVE" : "BLANK"}.`);
    } else if (itemName === ITEM_KEYS.HANDCUFFS) {
      const opponent = getNextAliveOpponent(s);
      opponent.turnsWaiting++; // Stacking as requested
      s.logs.push(`${actor.id} used ${ITEM_EMOJIS[itemName]} HANDCUFFS on ${opponent.id}.`);
    }
    
    if (s.shotgun.chamber.length === 0) {
      finalizeTurn(s, false, rng);
    }
  }

  if (action.type.startsWith("SHOOT")) {
    const target = action.type === "SHOOT_SELF" ? actor : s.players.find(p => p.id === action.targetId);
    const round = s.shotgun.chamber.pop();
    const isLive = !!round;
    
    if (isLive) s.shotgun.live--;
    else s.shotgun.blank--;
    
    s.shotgun.nextRoundRevealed = false; // Reset glass

    if (isLive) {
      target.health -= s.shotgun.damage;
      s.logs.push(`BOOM! ${target.id} took ${s.shotgun.damage} damage.`);
      if (target.health <= 0) {
        target.alive = false;
        target.health = 0;
        checkGameOver(s);
      }
    } else {
      s.logs.push(`*click* It was a BLANK.`);
    }

    s.shotgun.damage = 1; // Reset knife

    // Determine next turn
    let switchTurn = true;
    if (action.type === "SHOOT_SELF" && !isLive) {
      switchTurn = false; // Extra turn if shooting self with blank
      s.logs.push(`${actor.id} gets an extra turn!`);
    }

    finalizeTurn(s, switchTurn, rng);
  }

  return s;
}

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
            s.logs.push(`${alivePlayers[0].id} WINS!`);
        } else {
            s.logs.push("DRAW? No one survived.");
        }
    }
}

function finalizeTurn(s, switchTurn, rng) {
  if (s.shotgun.chamber.length === 0 && !s.gameOver) {
    refillShotgun(s, rng);
    giveItems(s, rng);
  }

  if (switchTurn) {
    nextTurn(s);
  }
}

function nextTurn(s) {
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
      s.logs.push(`${p.id} skips turn.`);
    } else {
      break;
    }
    attempts++;
  } while (attempts < s.players.length);
}
