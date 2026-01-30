
import { ITEM_KEYS } from "./gameLogic.js";

export function decideAIAction(state, rng) {
  const ai = state.players[state.currentTurnIndex];
  const chamber = state.shotgun.chamber;
  const roundsLeft = chamber.length;
  
  if (roundsLeft === 0) return null;

  // 1. Certainty checks
  const allLive = chamber.every(r => r === true);
  const allBlank = chamber.every(r => r === false);

  if (allLive) {
    if (ai.items.includes(ITEM_KEYS.KNIFE) && state.shotgun.damage === 1 && rng.random() < 0.6) {
      return { type: "USE_ITEM", item: ITEM_KEYS.KNIFE };
    }
    return { type: "SHOOT_PLAYER", playerId: ai.id, targetId: "YOU" };
  }

  if (allBlank) {
    return { type: "SHOOT_SELF", playerId: ai.id };
  }

  // 2. Health check
  if (ai.health < 3 && ai.items.includes(ITEM_KEYS.CIGARETTE)) {
    return { type: "USE_ITEM", item: ITEM_KEYS.CIGARETTE };
  }

  // 3. Strategic item usage
  if (roundsLeft < 5) {
    const liveCount = chamber.filter(r => r === true).length;
    const liveRatio = liveCount / roundsLeft;

    if (liveRatio >= 0.5) {
      const opp = state.players.find(p => p.id === "YOU");
      if (ai.items.includes(ITEM_KEYS.HANDCUFFS) && opp.turnsWaiting === 0) {
        return { type: "USE_ITEM", item: ITEM_KEYS.HANDCUFFS };
      }
      if (ai.items.includes(ITEM_KEYS.MAGNIFYING_GLASS) && !state.shotgun.nextRoundRevealed) {
        return { type: "USE_ITEM", item: ITEM_KEYS.MAGNIFYING_GLASS };
      }
      if (ai.items.includes(ITEM_KEYS.KNIFE) && state.shotgun.damage === 1 && rng.random() < 0.6) {
         return { type: "USE_ITEM", item: ITEM_KEYS.KNIFE };
      }
      return { type: "SHOOT_PLAYER", playerId: ai.id, targetId: "YOU" };
    }
  }

  // 4. Random item usage
  if (ai.items.length > 0 && rng.random() > 0.7) {
    const randomItem = ai.items[Math.floor(rng.random() * ai.items.length)];
    if (randomItem === ITEM_KEYS.MAGNIFYING_GLASS && state.shotgun.nextRoundRevealed) {
        // skip
    } else {
        return { type: "USE_ITEM", item: randomItem };
    }
  }

  // 5. Revealed check (Non-cheating)
  if (state.shotgun.nextRoundRevealed) {
      const nextIsLive = chamber[roundsLeft - 1]; 
      if (nextIsLive) {
          return { type: "SHOOT_PLAYER", playerId: ai.id, targetId: "YOU" };
      } else {
          return { type: "SHOOT_SELF", playerId: ai.id };
      }
  }

  // 6. Probabilistic shooting
  const simulatedRoundIsLive = rng.random() < (state.shotgun.live / roundsLeft);
  if (simulatedRoundIsLive) {
    return { type: "SHOOT_PLAYER", playerId: ai.id, targetId: "YOU" };
  } else {
    return { type: "SHOOT_SELF", playerId: ai.id };
  }
}
