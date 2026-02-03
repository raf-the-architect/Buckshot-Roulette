<template>
  <div class="game-hud">
    <!-- Turn Timer -->
    <TurnTimer 
      :time-remaining="gameStore.turnTimeRemaining"
      :is-my-turn="gameStore.isMyTurn"
    />

    <!-- Players Panel -->
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

        <!-- Items display -->
        <div class="player-items">
          <span v-if="!isMe(player)" class="item-count">
            {{ player.items?.length || 0 }} 📦
          </span>
          <div v-else class="my-items">
            <button
              v-for="(item, index) in player.items"
              :key="index"
              @click="selectItem(item)"
              :class="{ selected: selectedItem === item }"
              class="item-btn"
              :title="getItemInfo(item).name"
            >
              {{ getItemInfo(item).emoji }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Shotgun Status -->
    <div class="shotgun-status">
      <div class="rounds-info">
        <span class="live">🔴 {{ gameStore.currentGame?.shotgun?.liveRounds }} LIVE</span>
        <span class="blank">⚪ {{ gameStore.currentGame?.shotgun?.blankRounds }} BLANK</span>
        <span class="total">{{ gameStore.currentGame?.shotgun?.chamber?.length }} LEFT</span>
      </div>
      <div v-if="gameStore.currentGame?.shotgun?.isSawedOff" class="sawed-off">
        🔪 SAWED OFF (2x DAMAGE)
      </div>
      <div v-if="revealedRound" class="revealed-round">
        🔍 Next round is: {{ revealedRound === 'live' ? '🔴 LIVE' : '⚪ BLANK' }}
      </div>
    </div>

    <!-- Action Buttons -->
    <div v-if="gameStore.isMyTurn && gameStore.amAlive" class="action-panel">
      <button 
        v-if="canShoot"
        @click="openTargetSelector"
        class="btn-shoot"
      >
        🔫 SHOOT
      </button>
      <button 
        v-if="selectedItem"
        @click="useSelectedItem"
        class="btn-item"
      >
        USE {{ getItemInfo(selectedItem).name.toUpperCase() }}
      </button>
    </div>

    <!-- Not your turn indicator -->
    <div v-else-if="!gameStore.amAlive" class="spectating-notice">
      ☠️ You have been eliminated
    </div>
    <div v-else class="waiting-notice">
      Waiting for {{ currentPlayerName }}'s turn...
    </div>

    <!-- Target Selector Modal -->
    <div v-if="showTargetSelector" class="modal-overlay" @click.self="showTargetSelector = false">
      <div class="target-selector">
        <h3>Select Target</h3>
        <div class="targets-grid">
          <button
            v-for="target in validTargets"
            :key="target.userId"
            @click="shootTarget(target.userId)"
            class="target-btn"
          >
            {{ target.displayName }}
            <span class="target-health">❤️ {{ target.health }}</span>
          </button>
          <button
            @click="shootTarget(authStore.userId)"
            class="target-btn self"
          >
            Shoot Yourself
            <span class="target-health">❤️ {{ gameStore.myPlayer?.health }}</span>
          </button>
        </div>
        <button @click="showTargetSelector = false" class="btn-cancel">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { ITEM_INFO } from '@/utils/constants';
import TurnTimer from './TurnTimer.vue';

const gameStore = useGameStore();
const authStore = useAuthStore();

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
  return gameStore.currentGame?.players.filter(p => 
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

  // Some items need target selection
  const needsTarget = ['handcuffs', 'adrenaline'].includes(selectedItem.value);

  if (needsTarget) {
    showTargetSelector.value = true;
    return;
  }

  try {
    await gameStore.useItem(selectedItem.value);
    selectedItem.value = null;
  } catch (err) {
    console.error('Failed to use item:', err);
    alert('Failed to use item: ' + err.message);
  }
};

const openTargetSelector = () => {
  showTargetSelector.value = true;
};

const shootTarget = async (targetId) => {
  showTargetSelector.value = false;
  
  try {
    // If we had an item selected that needs target, use item instead
    if (selectedItem.value && ['handcuffs', 'adrenaline'].includes(selectedItem.value)) {
      await gameStore.useItem(selectedItem.value, targetId);
      selectedItem.value = null;
    } else {
      await gameStore.performShoot(targetId);
    }
  } catch (err) {
    console.error('Action failed:', err);
    alert('Action failed: ' + err.message);
  }
};
</script>

<style scoped>
.game-hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  padding: 1rem;
  flex-wrap: wrap;
}

.player-panel {
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  padding: 0.75rem;
  color: white;
  min-width: 120px;
  max-width: 150px;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.player-panel.active {
  border-color: #4CAF50;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.player-panel.dead {
  opacity: 0.4;
  filter: grayscale(100%);
}

.player-panel.self {
  border-color: #2196F3;
}

.player-avatar {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.avatar-letter {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.2rem;
}

.turn-indicator {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #4CAF50;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: bold;
}

.player-info {
  text-align: center;
}

.name {
  font-size: 0.85rem;
  font-weight: 600;
  display: block;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.health-bar {
  position: relative;
  height: 16px;
  background: #333;
  border-radius: 8px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, #f44336, #4CAF50);
  transition: width 0.3s;
}

.health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.65rem;
  font-weight: bold;
}

.player-items {
  margin-top: 0.5rem;
  text-align: center;
}

.item-count {
  font-size: 0.75rem;
  color: #aaa;
}

.my-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: center;
}

.item-btn {
  background: #333;
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.item-btn.selected {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.3);
}

.item-btn:hover {
  transform: scale(1.1);
}

.shotgun-status {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 1rem 2rem;
  border-radius: 12px;
  text-align: center;
  pointer-events: none;
}

.rounds-info {
  display: flex;
  gap: 1.5rem;
  font-size: 1rem;
  font-weight: bold;
}

.rounds-info .live { color: #f44336; }
.rounds-info .blank { color: #9e9e9e; }
.rounds-info .total { color: #FFD700; }

.sawed-off {
  color: #ff5722;
  margin-top: 0.5rem;
  font-weight: bold;
  animation: pulse 1s infinite;
}

.revealed-round {
  color: #4CAF50;
  margin-top: 0.5rem;
  font-weight: bold;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.action-panel {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
}

.btn-shoot {
  background: linear-gradient(135deg, #f44336 0%, #c62828 100%);
  color: white;
  padding: 1rem 3rem;
  font-size: 1.5rem;
  font-weight: bold;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  animation: shootPulse 1.5s infinite;
}

@keyframes shootPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(244, 67, 54, 0.4); }
  50% { transform: scale(1.03); box-shadow: 0 6px 30px rgba(244, 67, 54, 0.6); }
}

.btn-item {
  background: #2196F3;
  color: white;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-item:hover {
  background: #1976D2;
  transform: scale(1.02);
}

.waiting-notice, .spectating-notice {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #aaa;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1rem;
}

.spectating-notice {
  color: #f44336;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.target-selector {
  background: #1a1a2e;
  border-radius: 16px;
  padding: 2rem;
  min-width: 300px;
  color: white;
}

.target-selector h3 {
  text-align: center;
  margin-bottom: 1.5rem;
}

.targets-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.target-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 1rem;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.target-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #4CAF50;
}

.target-btn.self {
  background: rgba(33, 150, 243, 0.2);
  border-color: #2196F3;
}

.target-health {
  color: #f44336;
  font-size: 0.9rem;
}

.btn-cancel {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid #f44336;
  color: #f44336;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f44336;
  color: white;
}
</style>
