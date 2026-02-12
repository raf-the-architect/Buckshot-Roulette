<template>
  <div
    class="turn-timer bb-panel"
    :class="{ urgent: hasLimit && timeRemaining <= 10, 'my-turn': isMyTurn }"
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
          :style="{ strokeDashoffset: progressOffset }"
        />
      </svg>
      <span class="timer-text">{{ displayTime }}</span>
    </div>
    <span v-if="hasLimit" class="turn-label">
      <span v-if="isMyTurn">Your Turn</span>
      <span v-else>Other Player Turn</span>
    </span>
    <span v-else class="turn-label">No Turn Limit</span>
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
  },
  hasLimit: {
    type: Boolean,
    default: true
  }
});

const circumference = 2 * Math.PI * 45;
const displayTime = computed(() => (props.hasLimit ? props.timeRemaining : '∞'));
const progressOffset = computed(() => {
  if (!props.hasLimit) return 0;
  return circumference - (Math.max(0, props.timeRemaining) / 30) * circumference;
});
</script>

<style scoped>
.turn-timer {
  position: fixed;
  top: 0.9rem;
  right: 0.9rem;
  z-index: 150;
  width: 120px;
  padding: 0.55rem;
  display: grid;
  justify-items: center;
  gap: 0.35rem;
}

.timer-ring {
  position: relative;
  width: 64px;
  height: 64px;
}

.timer-ring svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.timer-bg {
  fill: none;
  stroke: rgba(39, 93, 156, 0.2);
  stroke-width: 8;
}

.timer-progress {
  fill: none;
  stroke: #4e9cf2;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: v-bind('circumference + "px"');
  transition: stroke-dashoffset 1s linear, stroke 0.3s;
}

.turn-timer.urgent .timer-progress {
  stroke: #f4861f;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2rem;
  font-family: var(--bb-font-display);
  color: var(--bb-blue-900);
}

.turn-label {
  text-align: center;
  font-size: 0.66rem;
  color: var(--bb-text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1.2;
}

.turn-timer.my-turn .turn-label {
  color: var(--bb-orange-900);
}

@media (max-width: 640px) {
  .turn-timer {
    width: 106px;
    padding: 0.45rem;
    right: 0.55rem;
  }

  .timer-ring {
    width: 58px;
    height: 58px;
  }
}
</style>
