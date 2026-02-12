<template>
  <div class="lobby-view">
    <GamePanel class="lobby-header" ribbon-text="Lobby" tone="alt">
      <template #header>
        <div class="lobby-title-row">
          <BrandLogo variant="header" size="190" />
          <div class="lobby-room-pill">
            <span>Room</span>
            <strong>{{ roomStore.roomId }}</strong>
          </div>
        </div>
      </template>

      <div class="invite-section">
        <div class="invite-code">
          <span class="code-label">Invite Code</span>
          <span class="code-value">{{ roomStore.currentRoom?.inviteCode }}</span>
          <GameButton variant="secondary" size="sm" :block="false" @click="copyCode">Copy</GameButton>
        </div>

        <div class="invite-link">
          <input :value="roomStore.currentRoom?.inviteLink" readonly class="bb-input link-input" />
          <GameButton variant="secondary" size="sm" @click="copyLink">Copy Link</GameButton>
        </div>
      </div>

      <template #footer>
        <div class="lobby-toolbar">
          <GameButton variant="ghost" size="sm" :block="false" @click="showSettings = true">Settings</GameButton>
        </div>
      </template>
    </GamePanel>

    <div class="players-grid">
      <PlayerCard
        v-for="player in roomStore.roomPlayers"
        :key="player.userId"
        :player="player"
        :is-host="roomStore.isHost"
        :is-me="player.userId === authStore.userId"
        @kick="roomStore.kickPlayer(player.userId)"
      />

      <div
        v-for="n in emptySlots"
        :key="'empty-' + n"
        class="player-slot empty bb-panel"
      >
        <div class="empty-icon">+</div>
        <span>Waiting for player...</span>
      </div>
    </div>

    <GamePanel class="lobby-actions-panel" ribbon-text="Ready Check">
      <div class="lobby-actions">
        <GameButton
          v-if="!isReady"
          variant="primary"
          @click="setReady(true)"
        >
          Ready
        </GameButton>
        <GameButton
          v-else
          variant="ghost"
          @click="setReady(false)"
        >
          Not Ready
        </GameButton>

        <GameButton
          v-if="roomStore.isHost"
          variant="secondary"
          :disabled="!roomStore.canStart"
          @click="startGame"
        >
          Start Match
        </GameButton>

        <GameButton variant="danger" @click="leaveRoom">Leave Room</GameButton>
      </div>

      <p v-if="!roomStore.canStart && roomStore.isHost" class="helper-text">
        {{ getStartHelperText }}
      </p>
    </GamePanel>

    <SettingsModal v-model="showSettings" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { MIN_PLAYERS, MAX_PLAYERS } from '@/utils/constants';
import { createLogger } from '@/utils/logger';
import BrandLogo from '@/components/ui/BrandLogo.vue';
import GameButton from '@/components/ui/GameButton.vue';
import GamePanel from '@/components/ui/GamePanel.vue';
import PlayerCard from './PlayerCard.vue';
import SettingsModal from '@/components/SettingsModal.vue';

const emit = defineEmits(['game-started', 'leave']);

const authStore = useAuthStore();
const roomStore = useRoomStore();
const gameStore = useGameStore();
const logger = createLogger('LobbyView');
const showSettings = ref(false);

const isReady = computed(() => {
  const me = roomStore.roomPlayers.find((p) => p.userId === authStore.userId);
  return me?.isReady || false;
});

const emptySlots = computed(() => {
  const max = roomStore.currentRoom?.maxPlayers || MAX_PLAYERS;
  return Math.max(0, max - roomStore.roomPlayers.length);
});

const getStartHelperText = computed(() => {
  if (roomStore.roomPlayers.length < MIN_PLAYERS) {
    return `Need at least ${MIN_PLAYERS} players to start`;
  }
  const notReady = roomStore.roomPlayers.filter((p) => !p.isReady);
  if (notReady.length > 0) {
    return `Waiting for ${notReady.map((p) => p.displayName).join(', ')} to ready up`;
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
    logger.error('start_game_click_failed', { error: err.message });
    alert('Failed to start game: ' + err.message);
  }
};

const leaveRoom = async () => {
  await roomStore.leaveRoom();
  emit('leave');
};

const copyCode = async () => {
  const code = roomStore.currentRoom?.inviteCode;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    alert('Invite code copied!');
  } catch (_err) {
    alert(code);
  }
};

const copyLink = async () => {
  const link = roomStore.currentRoom?.inviteLink;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    alert('Invite link copied!');
  } catch (_err) {
    alert(link);
  }
};
</script>

<style scoped>
.lobby-view {
  min-height: var(--app-height, 100dvh);
  padding: 1rem;
  display: grid;
  gap: 1rem;
  max-width: 980px;
  margin: 0 auto;
  overflow: auto;
}

.lobby-header {
  animation: bb-pop 180ms ease;
}

.lobby-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.lobby-room-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.38rem 0.8rem;
  border-radius: var(--bb-radius-pill);
  background: rgba(41, 120, 198, 0.12);
  border: 2px solid rgba(67, 118, 178, 0.38);
  color: var(--bb-blue-900);
}

.lobby-room-pill strong {
  letter-spacing: 0.06em;
}

.invite-section {
  display: grid;
  gap: 0.75rem;
}

.invite-code {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.code-label {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--bb-text-secondary);
}

.code-value {
  font-family: var(--bb-font-display);
  font-size: 1.3rem;
  color: var(--bb-orange-900);
  letter-spacing: 0.12em;
}

.invite-link {
  display: grid;
  grid-template-columns: 1fr 138px;
  gap: 0.6rem;
}

.link-input {
  text-align: left;
  padding-left: 1rem;
}

.lobby-toolbar {
  display: flex;
  justify-content: flex-end;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.85rem;
}

.player-slot.empty {
  min-height: 132px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.4rem;
  color: var(--bb-text-secondary);
}

.empty-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  background: rgba(44, 113, 188, 0.12);
  border: 2px solid rgba(66, 116, 176, 0.35);
}

.lobby-actions-panel {
  margin-bottom: 0.6rem;
}

.lobby-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.helper-text {
  margin: 0.8rem 0 0;
  text-align: center;
  font-size: 0.9rem;
  color: var(--bb-orange-900);
  font-weight: 700;
}

@media (max-width: 700px) {
  .invite-link {
    grid-template-columns: 1fr;
  }

  .lobby-actions {
    grid-template-columns: 1fr;
  }

  .lobby-toolbar {
    justify-content: center;
  }
}
</style>
