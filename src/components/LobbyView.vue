<template>
  <div class="lobby-view">
    <div class="lobby-header">
      <h1>Room: {{ roomStore.roomId }}</h1>
      <div class="invite-section">
        <div class="invite-code">
          <span class="code-label">Invite Code:</span>
          <span class="code-value">{{ roomStore.currentRoom?.inviteCode }}</span>
          <button @click="copyCode" class="btn-copy">📋 Copy</button>
        </div>
        <div class="invite-link">
          <input :value="roomStore.currentRoom?.inviteLink" readonly class="link-input" />
          <button @click="copyLink" class="btn-copy">🔗 Copy Link</button>
        </div>
      </div>
    </div>

    <div class="players-grid">
      <PlayerCard
        v-for="player in roomStore.roomPlayers"
        :key="player.userId"
        :player="player"
        :is-host="roomStore.isHost"
        :is-me="player.userId === authStore.userId"
        @kick="roomStore.kickPlayer(player.userId)"
      />

      <!-- Empty slots -->
      <div
        v-for="n in emptySlots"
        :key="'empty-' + n"
        class="player-slot empty"
      >
        <div class="empty-icon">👤</div>
        <span>Waiting for player...</span>
      </div>
    </div>

    <div class="lobby-actions">
      <button
        v-if="!isReady"
        @click="setReady(true)"
        class="btn-ready"
      >
        ✓ Ready
      </button>
      <button
        v-else
        @click="setReady(false)"
        class="btn-not-ready"
      >
        ✗ Not Ready
      </button>

      <button
        v-if="roomStore.isHost"
        @click="startGame"
        :disabled="!roomStore.canStart"
        class="btn-start"
      >
        🎮 Start Game
      </button>

      <button @click="leaveRoom" class="btn-leave">
        🚪 Leave Room
      </button>
    </div>

    <div class="lobby-footer">
      <p v-if="!roomStore.canStart && roomStore.isHost" class="helper-text">
        {{ getStartHelperText }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import PlayerCard from './PlayerCard.vue';

const emit = defineEmits(['game-started', 'leave']);

const authStore = useAuthStore();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const isReady = computed(() => {
  const me = roomStore.roomPlayers.find(p => p.userId === authStore.userId);
  return me?.isReady || false;
});

const emptySlots = computed(() => {
  const max = roomStore.currentRoom?.maxPlayers || 4;
  return Math.max(0, max - roomStore.roomPlayers.length);
});

const getStartHelperText = computed(() => {
  if (roomStore.roomPlayers.length < 2) {
    return 'Need at least 2 players to start';
  }
  const notReady = roomStore.roomPlayers.filter(p => !p.isReady);
  if (notReady.length > 0) {
    return `Waiting for ${notReady.map(p => p.displayName).join(', ')} to ready up`;
  }
  return '';
});

const setReady = (ready) => {
  roomStore.setReady(ready);
};

const startGame = async () => {
  try {
    await gameStore.startGame();
    emit('game-started');
  } catch (err) {
    console.error('Failed to start game:', err);
    alert('Failed to start game: ' + err.message);
  }
};

const leaveRoom = async () => {
  await roomStore.leaveRoom();
  emit('leave');
};

const copyCode = () => {
  navigator.clipboard.writeText(roomStore.currentRoom?.inviteCode);
  alert('Code copied!');
};

const copyLink = () => {
  navigator.clipboard.writeText(roomStore.currentRoom?.inviteLink);
  alert('Link copied!');
};
</script>

<style scoped>
.lobby-view {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}

.lobby-header {
  text-align: center;
  margin-bottom: 2rem;
}

.lobby-header h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #4CAF50;
}

.invite-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.invite-code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.code-label {
  color: #aaa;
}

.code-value {
  font-size: 1.5rem;
  font-weight: bold;
  font-family: monospace;
  letter-spacing: 4px;
  color: #FFD700;
}

.invite-link {
  display: flex;
  gap: 0.5rem;
}

.link-input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.9rem;
}

.btn-copy {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: #2196F3;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-copy:hover {
  background: #1976D2;
  transform: scale(1.02);
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.player-slot.empty {
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
  min-height: 120px;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.lobby-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.lobby-actions button {
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-ready {
  background: #4CAF50;
  color: white;
}

.btn-ready:hover {
  background: #45a049;
  transform: scale(1.02);
}

.btn-not-ready {
  background: #ff9800;
  color: white;
}

.btn-not-ready:hover {
  background: #f57c00;
}

.btn-start {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-start:disabled {
  background: #444;
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-start:not(:disabled):hover {
  transform: scale(1.02);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.btn-leave {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
  border: 1px solid #f44336;
}

.btn-leave:hover {
  background: #f44336;
  color: white;
}

.lobby-footer {
  text-align: center;
  margin-top: 2rem;
}

.helper-text {
  color: #FFD700;
  font-size: 0.9rem;
}
</style>
