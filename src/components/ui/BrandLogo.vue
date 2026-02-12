<template>
  <div class="brand-logo" :class="`brand-logo--${variant}`" :style="logoStyle" role="img" :aria-label="alt">
    <img class="brand-logo__image" :src="logoSrc" :alt="alt" draggable="false" />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  size: {
    type: [String, Number],
    default: 'hero'
  },
  variant: {
    type: String,
    default: 'hero'
  },
  alt: {
    type: String,
    default: 'Bang or Blank'
  }
});

const sizeMap = Object.freeze({
  hero: 320,
  header: 200,
  badge: 130
});

const srcMap = Object.freeze({
  hero: '/assets/branding/logo-hero.png',
  header: '/assets/branding/logo-header.png',
  badge: '/assets/branding/logo-badge.png'
});

const logoSrc = computed(() => srcMap[props.variant] || '/assets/images/logo.png');

const widthValue = computed(() => {
  if (typeof props.size === 'number') return `${props.size}px`;
  if (Object.prototype.hasOwnProperty.call(sizeMap, props.size)) {
    return `${sizeMap[props.size]}px`;
  }
  return props.size;
});

const logoStyle = computed(() => ({
  width: widthValue.value
}));
</script>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
}

.brand-logo__image {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 10px 16px rgba(22, 58, 113, 0.32));
  user-select: none;
  pointer-events: none;
}
</style>
