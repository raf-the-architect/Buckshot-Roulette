<template>
  <div class="game-hud">
    <TurnTimer
      :time-remaining="gameStore.turnTimeRemaining"
      :is-my-turn="gameStore.isMyTurn"
      :has-limit="gameStore.hasTurnTimeLimit"
    />

    <div class="players-container">
      <div
        v-for="player in gameStore.currentGame?.players"
        :key="player.userId"
        :class="[
          'player-panel',
          { active: isCurrentPlayer(player) },
          { dead: !player.isAlive },
          { self: isMe(player) }
        ]"
      >
        <div class="player-avatar">
          <div class="avatar-letter">{{ getInitial(player) }}</div>
          <div v-if="isCurrentPlayer(player)" class="turn-indicator">
            TURN
          </div>
        </div>

        <div class="player-info">
          <span class="name">{{ player.displayName }}</span>
          <div class="health-bar">
            <div
              class="health-fill"
              :style="{ width: (player.health / player.maxHealth * 100) + '%' }"
            />
            <span class="health-text">{{ player.health }}/{{ player.maxHealth }}</span>
          </div>
        </div>

        <div class="player-items">
          <span v-if="!isMe(player)" class="item-count">
            {{ player.items?.length || 0 }} items
          </span>
          <div v-else class="my-items">
            <button
              v-for="(item, index) in player.items"
              :key="index"
              @click="selectItem(item)"
              :class="{ selected: selectedItem === item }"
              class="item-btn"
              :title="getItemInfo(item).name"
              type="button"
            >
              {{ getItemInfo(item).emoji }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="shotgun-status bb-panel">
      <div class="rounds-info">
        <span class="live">🔴 {{ gameStore.currentGame?.shotgun?.liveRounds }} LIVE</span>
        <span class="blank">⚪ {{ gameStore.currentGame?.shotgun?.blankRounds }} BLANK</span>
        <span class="total">{{ gameStore.currentGame?.shotgun?.chamber?.length }} LEFT</span>
      </div>
      <div v-if="gameStore.currentGame?.shotgun?.isSawedOff" class="sawed-off">
        🔪 Sawed Off (2x Damage)
      </div>
      <div v-if="revealedRound" class="revealed-round">
        🔍 Next: {{ revealedRound === 'live' ? '🔴 LIVE' : '⚪ BLANK' }}
      </div>
    </div>

    <div v-if="gameStore.isMyTurn && gameStore.amAlive" class="action-panel">
      <button
        v-if="canShoot"
        @click="openTargetSelector"
        class="bb-btn bb-btn--primary"
        type="button"
      >
        Shoot
      </button>
      <button
        v-if="selectedItem"
        @click="useSelectedItem"
        class="bb-btn bb-btn--secondary"
        type="button"
      >
        Use {{ getItemInfo(selectedItem).name }}
      </button>
    </div>

    <div v-else-if="!gameStore.amAlive" class="spectating-notice bb-panel">
      Eliminated this round
    </div>
    <div v-else class="waiting-notice bb-panel">
      Waiting for {{ currentPlayerName }}...
    </div>

    <div v-if="showTargetSelector" class="modal-overlay" @click.self="showTargetSelector = false">
      <div class="target-selector bb-modal">
        <h3>Select Target</h3>
        <div class="targets-grid">
          <button
            v-for="target in validTargets"
            :key="target.userId"
            @click="shootTarget(target.userId)"
            class="target-btn"
            type="button"
          >
            {{ target.displayName }}
            <span class="target-health">{{ target.health }} HP</span>
          </button>
          <button
            @click="shootTarget(authStore.userId)"
            class="target-btn self"
            type="button"
          >
            Shoot Yourself
            <span class="target-health">{{ gameStore.myPlayer?.health }} HP</span>
          </button>
        </div>
        <button @click="showTargetSelector = false" class="bb-btn bb-btn--ghost" type="button">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { ITEM_INFO } from '@/utils/constants';
import { createLogger } from '@/utils/logger';
import TurnTimer from './TurnTimer.vue';

const gameStore = useGameStore();
const authStore = useAuthStore();
const logger = createLogger('GameHUD');

const selectedItem = ref(null);
const showTargetSelector = ref(false);

const isCurrentPlayer = (player) => {
  return gameStore.currentGame?.players[gameStore.currentGame?.currentTurn]?.userId === player.userId;
};

const isMe = (player) => player.userId === authStore.userId;

const getInitial = (player) => player.displayName?.charAt(0).toUpperCase() || '?';

const getItemInfo = (item) => {
  return ITEM_INFO[item] || { emoji: '❓', name: item };
};

const canShoot = computed(() => {
  return !gameStore.currentGame?.turnContext?.hasShot;
});

const currentPlayerName = computed(() => {
  return gameStore.currentPlayer?.displayName || 'opponent';
});

const validTargets = computed(() => {
  return gameStore.currentGame?.players.filter((p) =>
    p.isAlive && p.userId !== authStore.userId
  ) || [];
});

const revealedRound = computed(() => {
  return gameStore.currentGame?.turnContext?.revealedRound;
});

const selectItem = (item) => {
  selectedItem.value = selectedItem.value === item ? null : item;
};

const useSelectedItem = async () => {
  if (!selectedItem.value) return;

  const needsTarget = ['handcuffs', 'adrenaline'].includes(selectedItem.value);

  if (needsTarget) {
    showTargetSelector.value = true;
    return;
  }

  try {
    await gameStore.useItem(selectedItem.value);
    selectedItem.value = null;
  } catch (err) {
    logger.error('use_item_failed', { item: selectedItem.value, error: err.message });
    alert('Failed to use item: ' + err.message);
  }
};

const openTargetSelector = () => {
  showTargetSelector.value = true;
};

const shootTarget = async (targetId) => {
  showTargetSelector.value = false;

  try {
    if (selectedItem.value && ['handcuffs', 'adrenaline'].includes(selectedItem.value)) {
      await gameStore.useItem(selectedItem.value, targetId);
      selectedItem.value = null;
    } else {
      await gameStore.performShoot(targetId);
    }
  } catch (err) {
    logger.error('shoot_action_failed', { targetId, error: err.message });
    alert('Action failed: ' + err.message);
  }
};
</script>

<style scoped>
.game-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
}

.game-hud > * {
  pointer-events: auto;
}

.players-container {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.9rem 0.65rem 0;
  flex-wrap: wrap;
}

.player-panel {
  background: linear-gradient(180deg, rgba(252, 243, 219, 0.92) 0%, rgba(245, 225, 178, 0.92) 100%);
  border-radius: 14px;
  padding: 0.55rem;
  min-width: 122px;
  max-width: 156px;
  border: 2px solid rgba(68, 117, 176, 0.48);
  box-shadow: 0 8px 18px rgba(21, 58, 108, 0.3);
}

.player-panel.active {
  border-color: rgba(84, 194, 119, 0.85);
}

.player-panel.dead {
  opacity: 0.48;
  filter: grayscale(0.85);
}

.player-panel.self {
  border-color: rgba(79, 159, 242, 0.88);
}

.player-avatar {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 0.4rem;
}

.avatar-letter {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(180deg, #8fd6ff 0%, #4d94dd 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: var(--bb-font-display);
  font-size: 1.05rem;
}

.turn-indicator {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 177, 73, 0.95);
  color: #663009;
  padding: 1px 7px;
  border-radius: var(--bb-radius-pill);
  font-size: 0.56rem;
  font-weight: 800;
}

.player-info {
  text-align: center;
}

.name {
  font-size: 0.82rem;
  color: var(--bb-blue-900);
  font-weight: 700;
  display: block;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.health-bar {
  position: relative;
  height: 16px;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(28, 70, 122, 0.18);
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, #de5f4d, #57c97a);
  transition: width 0.3s;
}

.health-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.62rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.player-items {
  margin-top: 0.42rem;
  text-align: center;
}

.item-count {
  font-size: 0.73rem;
  color: var(--bb-text-secondary);
}

.my-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  justify-content: center;
}

.item-btn {
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 0.2rem;
  cursor: pointer;
  font-size: 0.92rem;
  background: rgba(34, 102, 177, 0.08);
}

.item-btn.selected {
  border-color: rgba(74, 181, 109, 0.8);
  background: rgba(74, 181, 109, 0.2);
}

.shotgun-status {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.75rem 1rem;
  text-align: center;
  pointer-events: none;
}

.rounds-info {
  display: flex;
  gap: 1rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--bb-blue-900);
}

.sawed-off,
.revealed-round {
  margin-top: 0.35rem;
  color: var(--bb-orange-900);
  font-size: 0.82rem;
  font-weight: 700;
}

.action-panel {
  position: fixed;
  bottom: 1.6rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.65rem;
}

.action-panel .bb-btn {
  min-width: 152px;
}

.waiting-notice,
.spectating-notice {
  position: fixed;
  bottom: 1.6rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.55rem 0.9rem;
  font-size: 0.92rem;
  color: var(--bb-blue-900);
}

.spectating-notice {
  color: #b1483a;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(18, 51, 94, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.target-selector {
  width: min(92vw, 340px);
  padding: 1rem;
  border-radius: var(--bb-radius-lg);
}

.target-selector h3 {
  margin: 0 0 0.8rem;
  text-align: center;
  color: var(--bb-blue-900);
  font-family: var(--bb-font-display);
}

.targets-grid {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-bottom: 0.8rem;
}

.target-btn {
  border: 2px solid rgba(67, 117, 176, 0.38);
  border-radius: 12px;
  padding: 0.65rem;
  background: rgba(35, 100, 173, 0.08);
  color: var(--bb-blue-900);
  cursor: pointer;
  font-weight: 700;
  display: flex;
  justify-content: space-between;
}

.target-btn.self {
  background: rgba(244, 134, 31, 0.14);
  border-color: rgba(151, 83, 25, 0.38);
}

.target-health {
  color: var(--bb-orange-900);
  font-size: 0.82rem;
}

@media (max-width: 640px) {
  .action-panel {
    width: calc(100vw - 2rem);
    justify-content: center;
    flex-wrap: wrap;
  }

  .action-panel .bb-btn {
    min-width: 130px;
  }
}
</style>
