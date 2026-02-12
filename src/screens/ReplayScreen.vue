<template>
  <div id="game-over-screen">
    <div class="replay-backdrop"></div>

    <GamePanel class="replay-card" :ribbon-text="result.isWin ? 'Great Shot!' : 'Try Again'" tone="alt">
      <template #header>
        <div class="replay-header">
          <BrandLogo variant="header" size="220" />
          <div class="result-icon" :class="result.isWin ? 'win' : 'lose'" aria-hidden="true">
            {{ result.isWin ? '🏆' : '💥' }}
          </div>
          <h1 class="result-title">{{ result.isWin ? 'Victory!' : 'Round Lost' }}</h1>
          <p class="result-message">
            {{ result.isWin ? 'You outplayed the table.' : 'The chamber beat you this time.' }}
          </p>
        </div>
      </template>

      <div class="player-name-display">
        <span class="player-label">Player</span>
        <span class="player-name">{{ result.playerName.toUpperCase() }}</span>
      </div>

      <div class="action-buttons">
        <GameButton variant="primary" size="lg" @click="onPlayAgain">Play Again</GameButton>
        <GameButton variant="secondary" @click="onQuit">Quit To Menu</GameButton>
        <GameButton variant="ghost" size="sm" @click="showSettings = true">Settings</GameButton>
      </div>
    </GamePanel>

    <SettingsModal v-model="showSettings" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import BrandLogo from '@/components/ui/BrandLogo.vue';
import GameButton from '@/components/ui/GameButton.vue';
import GamePanel from '@/components/ui/GamePanel.vue';
import SettingsModal from '@/components/SettingsModal.vue';

const props = defineProps({
  result: {
    type: Object,
    required: true,
    default: () => ({ isWin: false, playerName: 'PLAYER' })
  }
});

const emit = defineEmits(['play-again', 'quit']);
const showSettings = ref(false);

function onPlayAgain() {
  emit('play-again');
}

function onQuit() {
  emit('quit');
}
</script>

<style scoped>
#game-over-screen {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.replay-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 16% 10%, rgba(255, 206, 122, 0.4) 0%, rgba(255, 206, 122, 0) 45%),
    radial-gradient(circle at 82% 85%, rgba(118, 206, 255, 0.36) 0%, rgba(118, 206, 255, 0) 46%),
    linear-gradient(160deg, rgba(29, 73, 134, 0.9) 0%, rgba(35, 96, 169, 0.92) 46%, rgba(241, 135, 36, 0.86) 100%);
}

.replay-card {
  width: min(94vw, 470px);
  z-index: 1;
  animation: bb-pop 220ms ease;
}

.replay-header {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
}

.result-icon {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 2rem;
  border: 2px solid rgba(91, 128, 170, 0.45);
  box-shadow: 0 10px 18px rgba(20, 56, 106, 0.32);
}

.result-icon.win {
  background: linear-gradient(180deg, #ffd98a 0%, #ffb03f 100%);
}

.result-icon.lose {
  background: linear-gradient(180deg, #9fd8ff 0%, #62a5f1 100%);
}

.result-title {
  margin: 0;
  color: var(--bb-blue-900);
  font-family: var(--bb-font-display);
  font-size: 2rem;
  letter-spacing: 0.01em;
}

.result-message {
  margin: 0;
  color: var(--bb-text-secondary);
  font-size: 0.95rem;
}

.player-name-display {
  margin: 0.8rem 0 1rem;
  background: rgba(37, 102, 178, 0.12);
  border: 2px solid rgba(67, 118, 178, 0.32);
  border-radius: var(--bb-radius-pill);
  padding: 0.65rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
}

.player-label {
  color: var(--bb-text-secondary);
  font-weight: 700;
  font-size: 0.85rem;
}

.player-name {
  color: var(--bb-orange-900);
  font-family: var(--bb-font-display);
  font-size: 1.15rem;
}

.action-buttons {
  display: grid;
  gap: 0.65rem;
}
</style>
