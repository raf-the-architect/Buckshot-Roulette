<template>
  <div id="start-screen">
    <div class="glass-card">
      <h1 class="game-title">Buckshot<br>Roulette</h1>
      <p class="game-subtitle">
        Take turns.<br>
        Choose wisely.<br>
        Survive the round!
      </p>

      <div class="input-group">
        <input 
          type="text" 
          class="name-input" 
          placeholder="Enter Player Name" 
          maxlength="12"
          autocomplete="off" 
          v-model="playerNameProxy" 
          @keydown.enter="handleSinglePlayer" 
          :disabled="isLoading"
          ref="nameInput" 
        />
      </div>

      <!-- Game Mode Buttons -->
      <div class="mode-buttons">
        <button 
          class="start-btn single-player" 
          :disabled="!canStart || isLoading" 
          @click="handleSinglePlayer"
        >
          {{ isLoading ? 'Loading...' : '🎮 Single Player' }}
        </button>

        <div class="multiplayer-section">
          <button 
            class="start-btn create-room" 
            :disabled="isLoading" 
            @click="handleCreateRoom"
          >
            🌐 Create Room
          </button>
          
          <div class="join-section">
            <input 
              type="text" 
              class="room-code-input" 
              placeholder="Room Code"
              v-model="roomCode"
              maxlength="6"
              @keydown.enter="handleJoinRoom"
              :disabled="isLoading"
            />
            <button 
              class="join-btn" 
              :disabled="!roomCode.trim() || isLoading" 
              @click="handleJoinRoom"
            >
              Join
            </button>
          </div>
        </div>
      </div>

      <p class="version-tag">v2.0 - Multiplayer Edition</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'start-game', 'create-room', 'join-room']);

const isLoading = ref(false);
const nameInput = ref(null);
const roomCode = ref('');

const playerNameProxy = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const canStart = computed(() => props.modelValue.trim().length > 0);

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
  if (isLoading.value) return;
  emit('create-room');
}

function handleJoinRoom() {
  if (!roomCode.value.trim() || isLoading.value) return;
  emit('join-room', roomCode.value.trim().toUpperCase());
}

function focusInput() {
  nameInput.value?.focus();
}

defineExpose({ focusInput });
</script>

<style scoped>
#start-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 1rem;
}

.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 3rem 2rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 400px;
  width: 100%;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.game-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
  margin-bottom: 1rem;
  line-height: 1.1;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.game-subtitle {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
}

.input-group {
  margin-bottom: 1.5rem;
}

.name-input {
  width: 100%;
  padding: 1rem 1.5rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1.1rem;
  text-align: center;
  outline: none;
  transition: all 0.3s;
}

.name-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.name-input:focus {
  border-color: #4CAF50;
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.3);
}

.mode-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.start-btn {
  width: 100%;
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.start-btn.single-player {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
}

.start-btn.single-player:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.start-btn.create-room {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.start-btn.create-room:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.multiplayer-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 0.5rem;
}

.join-section {
  display: flex;
  gap: 0.5rem;
}

.room-code-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
  outline: none;
  transition: all 0.3s;
}

.room-code-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
  text-transform: none;
  letter-spacing: normal;
}

.room-code-input:focus {
  border-color: #2196F3;
}

.join-btn {
  padding: 0.75rem 1.5rem;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.join-btn:hover:not(:disabled) {
  background: #1976D2;
}

.join-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.version-tag {
  margin-top: 2rem;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.75rem;
}
</style>
