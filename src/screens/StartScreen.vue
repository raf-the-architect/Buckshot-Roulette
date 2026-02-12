<template>
  <div id="start-screen">
    <div class="start-screen__bg-glow start-screen__bg-glow--left"></div>
    <div class="start-screen__bg-glow start-screen__bg-glow--right"></div>

    <GamePanel class="start-panel" ribbon-text="Bang or Blank" tone="alt">
      <template #header>
        <div class="start-header">
          <BrandLogo variant="hero" size="clamp(220px, 62vw, 340px)" />
          <p class="game-subtitle">
            Quick rounds. Smart choices.
            <br />
            Bang, bluff, and survive.
          </p>
        </div>
      </template>

      <div class="input-group">
        <input
          type="text"
          class="bb-input"
          placeholder="Enter Player Name"
          maxlength="12"
          autocomplete="off"
          v-model="playerNameProxy"
          @keydown.enter="handleSinglePlayer"
          :disabled="isLoading"
          ref="nameInput"
        />
      </div>

      <div class="mode-buttons">
        <GameButton
          variant="primary"
          size="lg"
          :disabled="!canStart || isLoading"
          :loading="isLoading"
          @click="handleSinglePlayer"
        >
          {{ isLoading ? 'Loading...' : 'Single Player' }}
        </GameButton>

        <GameButton
          variant="secondary"
          size="lg"
          :disabled="!canMultiplayer || isLoading"
          @click="handleCreateRoom"
        >
          Create Room
        </GameButton>

        <div class="join-section">
          <input
            type="text"
            class="bb-input room-code-input"
            placeholder="Room Code"
            v-model="roomCode"
            maxlength="6"
            @keydown.enter="handleJoinRoom"
            :disabled="isLoading"
          />
          <GameButton
            variant="secondary"
            size="md"
            class="join-button"
            :disabled="!canMultiplayer || !roomCode.trim() || isLoading"
            @click="handleJoinRoom"
          >
            Join
          </GameButton>
        </div>
      </div>

      <template #footer>
        <div class="start-footer">
          <GameButton variant="ghost" size="sm" :block="false" @click="showSettings = true">Settings</GameButton>
          <p class="version-tag">v2.0 Multiplayer Edition</p>
        </div>
      </template>
    </GamePanel>

    <SettingsModal v-model="showSettings" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import BrandLogo from '@/components/ui/BrandLogo.vue';
import GameButton from '@/components/ui/GameButton.vue';
import GamePanel from '@/components/ui/GamePanel.vue';
import SettingsModal from '@/components/SettingsModal.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  initialRoomCode: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'start-game', 'create-room', 'join-room']);

const isLoading = ref(false);
const nameInput = ref(null);
const roomCode = ref('');
const showSettings = ref(false);

const playerNameProxy = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const canStart = computed(() => props.modelValue.trim().length > 0);
const canMultiplayer = computed(() => canStart.value);

const normalizeRoomCode = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .slice(0, 6);

watch(
  () => props.initialRoomCode,
  (nextCode) => {
    const normalized = normalizeRoomCode(nextCode);
    roomCode.value = normalized;
  },
  { immediate: true }
);

function handleSinglePlayer() {
  if (!canStart.value || isLoading.value) return;

  isLoading.value = true;
  emit('start-game', {
    onSuccess: () => {
      isLoading.value = false;
    }
  });
}

function handleCreateRoom() {
  if (!canMultiplayer.value || isLoading.value) return;
  emit('create-room');
}

function handleJoinRoom() {
  if (!canMultiplayer.value || !roomCode.value.trim() || isLoading.value) return;
  emit('join-room', roomCode.value.trim().toUpperCase());
}

function focusInput() {
  nameInput.value?.focus();
}

defineExpose({ focusInput });
</script>

<style scoped>
#start-screen {
  min-height: var(--app-height, 100dvh);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

.start-screen__bg-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.start-screen__bg-glow--left {
  width: 52vw;
  height: 52vw;
  min-width: 260px;
  min-height: 260px;
  left: -18vw;
  top: -14vw;
  background: radial-gradient(circle, rgba(255, 196, 109, 0.42) 0%, rgba(255, 196, 109, 0) 72%);
}

.start-screen__bg-glow--right {
  width: 56vw;
  height: 56vw;
  min-width: 280px;
  min-height: 280px;
  right: -20vw;
  bottom: -22vw;
  background: radial-gradient(circle, rgba(130, 212, 255, 0.38) 0%, rgba(130, 212, 255, 0) 72%);
}

.start-panel {
  position: relative;
  z-index: 1;
  width: min(92vw, 470px);
  animation: bb-pop 220ms ease;
}

.start-header {
  display: grid;
  justify-items: center;
  gap: 0.7rem;
}

.game-subtitle {
  margin: 0;
  font-family: var(--bb-font-display);
  text-align: center;
  color: var(--bb-text-secondary);
  line-height: 1.34;
  font-size: 0.98rem;
}

.input-group {
  margin-bottom: 0.95rem;
}

.mode-buttons {
  display: grid;
  gap: 0.72rem;
}

.join-section {
  display: grid;
  grid-template-columns: 1fr 132px;
  gap: 0.6rem;
}

.room-code-input {
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.join-button {
  align-self: stretch;
}

.start-footer {
  display: grid;
  gap: 0.45rem;
  justify-items: center;
}

.version-tag {
  margin: 0;
  color: rgba(32, 72, 117, 0.62);
  font-size: 0.77rem;
  font-weight: 600;
}

@media (max-width: 520px) {
  .join-section {
    grid-template-columns: 1fr;
  }
}
</style>
