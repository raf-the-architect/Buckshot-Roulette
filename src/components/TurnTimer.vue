<template>
  <div 
    class="turn-timer"
    :class="{ urgent: timeRemaining <= 10, 'my-turn': isMyTurn }"
  >
    <div class="timer-ring">
      <svg viewBox="0 0 100 100">
        <circle
          class="timer-bg"
          cx="50"
          cy="50"
          r="45"
        />
        <circle
          class="timer-progress"
          cx="50"
          cy="50"
          r="45"
          :style="{ strokeDashoffset: circumference - (timeRemaining / 30) * circumference }"
        />
      </svg>
      <span class="timer-text">{{ timeRemaining }}</span>
    </div>
    <span v-if="isMyTurn" class="turn-label">YOUR TURN</span>
    <span v-else class="turn-label">OPPONENT'S TURN</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  timeRemaining: {
    type: Number,
    default: 30
  },
  isMyTurn: {
    type: Boolean,
    default: false
  }
});

const circumference = 2 * Math.PI * 45;
</script>

<style scoped>
.turn-timer {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 150;
}

.timer-ring {
  position: relative;
  width: 70px;
  height: 70px;
}

.timer-ring svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.timer-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 8;
}

.timer-progress {
  fill: none;
  stroke: #4CAF50;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: v-bind('circumference + "px"');
  transition: stroke-dashoffset 1s linear, stroke 0.3s;
}

.turn-timer.urgent .timer-progress {
  stroke: #f44336;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
}

.turn-timer.urgent .timer-text {
  color: #f44336;
  animation: urgentPulse 0.5s infinite;
}

@keyframes urgentPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.1); }
}

.turn-label {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #888;
  font-weight: bold;
  text-transform: uppercase;
}

.turn-timer.my-turn .turn-label {
  color: #4CAF50;
}
</style>
