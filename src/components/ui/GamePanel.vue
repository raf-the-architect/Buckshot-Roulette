<template>
  <section :class="['bb-panel', { 'bb-panel--alt': tone === 'alt' }]">
    <div v-if="ribbonText" class="bb-panel__ribbon">{{ ribbonText }}</div>

    <header v-if="$slots.header || title" class="game-panel__header">
      <slot name="header">
        <h2 class="game-panel__title">{{ title }}</h2>
      </slot>
    </header>

    <div class="game-panel__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="game-panel__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  ribbonText: {
    type: String,
    default: ''
  },
  tone: {
    type: String,
    default: 'default'
  }
});
</script>

<style scoped>
.game-panel__header {
  margin-bottom: 0.95rem;
}

.game-panel__title {
  margin: 0;
  text-align: center;
  color: var(--bb-blue-900);
  font-family: var(--bb-font-display);
  font-size: 1.35rem;
  letter-spacing: 0.01em;
}

.game-panel__footer {
  margin-top: 1.15rem;
}
</style>
