<template>
  <div class="game-slider">
    <div class="game-slider__head">
      <span class="game-slider__label">{{ label }}</span>
      <span class="bb-chip">{{ displayValue }}</span>
    </div>

    <div class="bb-slider">
      <button class="bb-slider__btn" type="button" @click="stepDown" :disabled="disabled">-</button>
      <input
        class="bb-slider__track"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="safeModelValue"
        :disabled="disabled"
        @input="onInput"
      />
      <button class="bb-slider__btn" type="button" @click="stepUp" :disabled="disabled">+</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  step: {
    type: Number,
    default: 1
  },
  label: {
    type: String,
    default: ''
  },
  suffix: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const clamp = (value) => Math.min(props.max, Math.max(props.min, value));

const safeModelValue = computed(() => clamp(Number(props.modelValue) || 0));

const displayValue = computed(() => `${safeModelValue.value}${props.suffix}`);

function setValue(nextValue) {
  emit('update:modelValue', clamp(nextValue));
}

function onInput(event) {
  const nextValue = Number(event.target.value);
  if (!Number.isFinite(nextValue)) return;
  setValue(nextValue);
}

function stepDown() {
  setValue(safeModelValue.value - props.step);
}

function stepUp() {
  setValue(safeModelValue.value + props.step);
}
</script>

<style scoped>
.game-slider {
  display: grid;
  gap: 0.45rem;
}

.game-slider__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.game-slider__label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--bb-blue-900);
}

.bb-slider__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.bb-slider__track:disabled {
  opacity: 0.6;
}
</style>
