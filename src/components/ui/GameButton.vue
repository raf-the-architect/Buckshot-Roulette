<template>
  <button
    :type="type"
    :disabled="isDisabled"
    :class="[
      'bb-btn',
      `bb-btn--${variant}`,
      sizeClass,
      {
        'is-pressed': pressed,
        'is-loading': loading,
        'bb-btn--block': block,
      },
    ]"
    @click="handleClick"
  >
    <span v-if="$slots.icon" class="game-button__icon"><slot name="icon" /></span>
    <span class="game-button__label">
      <slot />
    </span>
    <span v-if="loading" class="game-button__spinner" aria-hidden="true"></span>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'md'
  },
  type: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  pressed: {
    type: Boolean,
    default: false
  },
  block: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['click']);

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'bb-btn--sm';
  if (props.size === 'lg') return 'bb-btn--lg';
  return '';
});

const isDisabled = computed(() => props.disabled || props.loading);

function handleClick(event) {
  if (isDisabled.value) return;
  emit('click', event);
}
</script>

<style scoped>
.bb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.bb-btn--block {
  width: 100%;
}

.game-button__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.game-button__spinner {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 247, 223, 0.35);
  border-top-color: rgba(255, 247, 223, 0.92);
  animation: button-spin 700ms linear infinite;
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
