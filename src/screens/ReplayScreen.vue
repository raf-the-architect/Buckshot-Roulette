<template>
  <div id="game-over-screen">
    <div class="game-over-container">
      <!-- Celebration Background -->
      <div class="celebration-bg">
        <div class="floating-shapes">
          <div class="shape shape-1"></div>
          <div class="shape shape-2"></div>
          <div class="shape shape-3"></div>
          <div class="shape shape-4"></div>
          <div class="shape shape-5"></div>
          <div class="shape shape-6"></div>
        </div>
      </div>

      <!-- Game Over Card -->
      <div class="game-over-card" ref="gameOverCard">
        <div class="result-icon">
          <div :class="['icon-wrapper', result.isWin ? 'win-icon' : 'lose-icon']"></div>
        </div>

        <h1 class="result-title">{{ result.isWin ? 'Victory!' : 'Game Over' }}</h1>
        <p class="result-message">{{ result.isWin ? 'You defeated the Dealer!' : 'The Dealer got you...' }}</p>

        <div class="player-name-display">
          <span class="player-label">Player</span>
          <span class="player-name">{{ result.playerName.toUpperCase() }}</span>
        </div>

        <div class="action-buttons">
          <button class="play-again-btn" @click="onPlayAgain">
            <span class="btn-text">Play Again</span>
            <div class="btn-glow"></div>
          </button>

          <button class="quit-btn" @click="onQuit">
            <span class="btn-text">Quit to Menu</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  result: {
    type: Object,
    required: true,
    default: () => ({ isWin: false, playerName: 'PLAYER' })
  }
});

const emit = defineEmits(['play-again', 'quit']);

const gameOverCard = ref(null);

onMounted(() => {
  if (gameOverCard.value) {
    gameOverCard.value.style.animation = 'none';
    void gameOverCard.value.offsetHeight;
    gameOverCard.value.style.animation = 'slideUpBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
  }
});

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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.game-over-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.celebration-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(ellipse at center, rgba(26, 26, 46, 0.95) 0%, rgba(0, 0, 0, 0.98) 100%);
}

.floating-shapes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.shape {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
  animation: float 20s infinite ease-in-out;
}

.shape-1 { width: 300px; height: 300px; background: #4CAF50; top: -100px; left: -100px; }
.shape-2 { width: 200px; height: 200px; background: #667eea; bottom: -50px; right: -50px; animation-delay: 3s; }
.shape-3 { width: 150px; height: 150px; background: #f44336; top: 50%; left: 10%; animation-delay: 5s; }
.shape-4 { width: 100px; height: 100px; background: #FFD700; top: 20%; right: 20%; animation-delay: 7s; }
.shape-5 { width: 250px; height: 250px; background: #764ba2; bottom: 20%; left: 20%; animation-delay: 2s; }
.shape-6 { width: 120px; height: 120px; background: #2196F3; top: 60%; right: 10%; animation-delay: 4s; }

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-30px) rotate(10deg); }
}

.game-over-card {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 3rem 2rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 400px;
  width: 90%;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

@keyframes slideUpBounce {
  0% { opacity: 0; transform: translateY(50px); }
  100% { opacity: 1; transform: translateY(0); }
}

.result-icon {
  margin-bottom: 1.5rem;
}

.icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.win-icon {
  background: linear-gradient(135deg, #4CAF50, #81C784);
  box-shadow: 0 0 40px rgba(76, 175, 80, 0.5);
}

.win-icon::after {
  content: '🏆';
  font-size: 2.5rem;
}

.lose-icon {
  background: linear-gradient(135deg, #f44336, #ef5350);
  box-shadow: 0 0 40px rgba(244, 67, 54, 0.5);
}

.lose-icon::after {
  content: '💀';
  font-size: 2.5rem;
}

.result-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
  margin-bottom: 0.5rem;
}

.result-message {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.player-name-display {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 2rem;
}

.player-label {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 0.25rem;
}

.player-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.play-again-btn {
  position: relative;
  width: 100%;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s;
}

.play-again-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.btn-glow {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: shine 3s infinite;
}

@keyframes shine {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

.quit-btn {
  width: 100%;
  padding: 1rem 2rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.quit-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}
</style>
