<template>
  <div class="game-log-container" :class="{ collapsed: !expanded }">
    <button
      class="toggle-btn"
      @click="toggleExpanded"
      :title="expanded ? 'Collapse' : 'Expand'"
      type="button"
    >
      <span class="toggle-icon">{{ expanded ? '◀' : '▶' }}</span>
      <span v-if="!expanded" class="log-badge" v-show="unreadCount > 0">{{ unreadCount }}</span>
    </button>

    <transition name="slide">
      <div v-if="expanded" class="log-panel bb-panel">
        <div class="log-header">
          <h3>Game Log</h3>
          <button @click="clearLog" class="clear-btn" title="Clear log" type="button">Clear</button>
        </div>

        <div class="log-entries" ref="logContainer">
          <TransitionGroup name="log-item">
            <div
              v-for="entry in displayedEntries"
              :key="entry.id"
              :class="['log-entry', `log-${entry.type}`]"
            >
              <span class="entry-icon">{{ getEntryIcon(entry) }}</span>
              <span class="entry-message">{{ entry.message }}</span>
              <span class="entry-time">{{ entry.timestamp }}</span>
            </div>
          </TransitionGroup>

          <div v-if="displayedEntries.length === 0" class="empty-log">
            No actions yet...
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useUIStore } from '@/stores/uiStore';

const uiStore = useUIStore();
const logContainer = ref(null);
const expanded = ref(true);
const lastSeenCount = ref(0);

const displayedEntries = computed(() => {
  return uiStore.gameLog.slice(-30);
});

const unreadCount = computed(() => {
  return Math.max(0, uiStore.gameLog.length - lastSeenCount.value);
});

function getEntryIcon(entry) {
  if (entry.icon) return entry.icon;

  const iconMap = {
    action: '🎯',
    damage: '💥',
    item: '🎁',
    turn: '🔄',
    system: 'ℹ️',
    win: '🏆',
    death: '☠️',
    heal: '💚',
  };

  return iconMap[entry.type] || 'ℹ️';
}

function toggleExpanded() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    lastSeenCount.value = uiStore.gameLog.length;
  }
}

function clearLog() {
  uiStore.clearGameLog();
  lastSeenCount.value = 0;
}

watch(
  () => uiStore.gameLog.length,
  async () => {
    if (expanded.value) {
      lastSeenCount.value = uiStore.gameLog.length;
      await nextTick();
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    }
  },
);

onMounted(() => {
  lastSeenCount.value = uiStore.gameLog.length;
});
</script>

<style scoped>
.game-log-container {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 200;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: 355px;
  pointer-events: auto;
}

.toggle-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid rgba(56, 107, 167, 0.5);
  background: linear-gradient(180deg, #8fd8ff 0%, #4f98df 100%);
  color: #f7fbff;
  cursor: pointer;
  box-shadow: 0 4px 0 rgba(24, 67, 118, 0.86);
  font-size: 0.9rem;
  position: relative;
}

.toggle-btn:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 rgba(24, 67, 118, 0.86);
}

.log-badge {
  position: absolute;
  top: -5px;
  right: -6px;
  background: linear-gradient(180deg, #ffa880 0%, #e4684a 100%);
  color: #fff;
  border-radius: var(--bb-radius-pill);
  min-width: 18px;
  text-align: center;
  padding: 1px 5px;
  font-size: 0.64rem;
  font-weight: 700;
}

.log-panel {
  width: min(300px, calc(100vw - 4rem));
  padding: 0.75rem;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.55rem;
}

.log-header h3 {
  margin: 0;
  color: var(--bb-blue-900);
  font-family: var(--bb-font-display);
  font-size: 0.95rem;
}

.clear-btn {
  border: none;
  border-radius: var(--bb-radius-pill);
  background: rgba(36, 94, 163, 0.12);
  color: var(--bb-blue-900);
  padding: 0.2rem 0.58rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.log-entries {
  max-height: 250px;
  overflow-y: auto;
  display: grid;
  gap: 0.3rem;
}

.log-entry {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.35rem;
  align-items: center;
  border-radius: 10px;
  padding: 0.38rem 0.45rem;
  background: rgba(31, 99, 173, 0.09);
  border-left: 3px solid transparent;
  font-size: 0.77rem;
}

.log-action {
  border-left-color: #57c97a;
}

.log-damage {
  border-left-color: #de5f4d;
}

.log-item {
  border-left-color: #f4861f;
}

.log-turn {
  border-left-color: #59a6ff;
}

.log-system {
  border-left-color: #7d93b4;
}

.log-win {
  border-left-color: #ffb347;
}

.log-death {
  border-left-color: #b66e66;
}

.log-heal {
  border-left-color: #57c97a;
}

.entry-message {
  color: var(--bb-blue-900);
}

.entry-time {
  color: rgba(36, 85, 140, 0.66);
  font-size: 0.65rem;
}

.empty-log {
  text-align: center;
  color: var(--bb-text-secondary);
  padding: 0.8rem;
  font-size: 0.85rem;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

.log-item-enter-active,
.log-item-leave-active {
  transition: all 0.2s ease;
}

.log-item-enter-from,
.log-item-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .game-log-container {
    right: 0.5rem;
    bottom: 0.5rem;
  }

  .log-panel {
    width: calc(100vw - 4rem);
  }
}
</style>
