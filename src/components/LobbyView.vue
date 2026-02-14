<template>
  <div class="lobby-view">
    <GamePanel class="lobby-header" ribbon-text="Lobby" tone="alt">
      <template #header>
        <div class="lobby-title-row">
          <BrandLogo variant="header" size="190" />
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
    </div>

    <GamePanel class="lobby-actions-panel" ribbon-text="Ready Check">
      <div class="lobby-actions">
        <GameButton
          v-if="!isReady"
          variant="secondary"
          @click="setReady(true)"
        >
          Ready
        </GameButton>
        <GameButton
          v-else
          variant="secondary"
          @click="setReady(false)"
        >
          Cancel Ready
        </GameButton>
      </div>
    </GamePanel>

    <div class="lobby-bottom-actions bb-panel" :class="{ host: roomStore.isHost }">
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

    <SettingsModal v-model="showSettings" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
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
  padding: 1rem 1rem calc(7rem + env(safe-area-inset-bottom, 0px));
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
  justify-content: center;
  gap: 0.8rem;
  flex-wrap: wrap;
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
  color: var(--bb-blue-900);
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

.lobby-actions-panel {
  margin-bottom: 0;
}

.lobby-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.6rem;
}

.lobby-bottom-actions {
  position: sticky;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 0.45rem);
  z-index: 8;
  display: grid;
  gap: 0.7rem;
  padding: 0.75rem;
  backdrop-filter: blur(4px);
}

.lobby-bottom-actions.host {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 700px) {
  .invite-link {
    grid-template-columns: 1fr;
  }

  .lobby-toolbar {
    justify-content: center;
  }

  .lobby-bottom-actions.host {
    grid-template-columns: 1fr;
  }
}
</style>
