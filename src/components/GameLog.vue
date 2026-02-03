<template>
  <div class="game-log-container" :class="{ collapsed: !expanded }">
    <!-- Toggle Button -->
    <button
      class="toggle-btn"
      @click="toggleExpanded"
      :title="expanded ? 'Collapse' : 'Expand'"
    >
      <span class="toggle-icon">{{ expanded ? "◀" : "▶" }}</span>
      <span v-if="!expanded" class="log-badge" v-show="unreadCount > 0">{{
        unreadCount
      }}</span>
    </button>

    <!-- Log Panel -->
    <transition name="slide">
      <div v-if="expanded" class="log-panel">
        <div class="log-header">
          <h3>📜 Game Log</h3>
          <button @click="clearLog" class="clear-btn" title="Clear log">
            🗑️
          </button>
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
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useUIStore } from "@/stores/uiStore";

const uiStore = useUIStore();
const logContainer = ref(null);
const expanded = ref(true);
const lastSeenCount = ref(0);

// Display entries from uiStore
const displayedEntries = computed(() => {
  return uiStore.gameLog.slice(-30); // Show last 30 entries
});

// Unread count for collapsed state
const unreadCount = computed(() => {
  return Math.max(0, uiStore.gameLog.length - lastSeenCount.value);
});

// Get icon based on entry type
function getEntryIcon(entry) {
  if (entry.icon) return entry.icon;

  const iconMap = {
    action: "🎯",
    damage: "💥",
    item: "🎁",
    turn: "🔄",
    system: "ℹ️",
    win: "🏆",
    death: "☠️",
    heal: "💚",
  };

  return iconMap[entry.type] || "ℹ️";
}

// Toggle expanded state
function toggleExpanded() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    lastSeenCount.value = uiStore.gameLog.length;
  }
}

// Clear the log
function clearLog() {
  uiStore.clearGameLog();
  lastSeenCount.value = 0;
}

// Auto-scroll to bottom when new entries arrive
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

// Initialize seen count
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
  max-width: 350px;
  pointer-events: auto;
}

.game-log-container.collapsed {
  max-width: auto;
}

.toggle-btn {
  background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
  border: 1px solid rgba(255, 215, 0, 0.3);
  color: #ffd700;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  position: relative;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
  border-color: #ffd700;
  transform: scale(1.1);
}

.toggle-icon {
  transition: transform 0.3s ease;
}

.log-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #f44336;
  color: white;
  font-size: 0.65rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  animation: pulse 1s infinite;
}

.log-panel {
  background: linear-gradient(
    145deg,
    rgba(30, 30, 30, 0.95),
    rgba(20, 20, 20, 0.98)
  );
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  width: 300px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(255, 215, 0, 0.1);
  border-bottom: 1px solid rgba(255, 215, 0, 0.15);
}

.log-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: #ffd700;
  font-weight: 600;
}

.clear-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.6;
  transition:
    opacity 0.2s,
    transform 0.2s;
  padding: 4px;
}

.clear-btn:hover {
  opacity: 1;
  transform: scale(1.2);
}

.log-entries {
  max-height: 250px;
  overflow-y: auto;
  padding: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 215, 0, 0.3) transparent;
}

.log-entries::-webkit-scrollbar {
  width: 6px;
}

.log-entries::-webkit-scrollbar-track {
  background: transparent;
}

.log-entries::-webkit-scrollbar-thumb {
  background: rgba(255, 215, 0, 0.3);
  border-radius: 3px;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border-left: 3px solid transparent;
  font-size: 0.8rem;
  transition: background 0.2s;
}

.log-entry:hover {
  background: rgba(255, 255, 255, 0.08);
}

.log-action {
  border-left-color: #4caf50;
}
.log-damage {
  border-left-color: #f44336;
}
.log-item {
  border-left-color: #9c27b0;
}
.log-turn {
  border-left-color: #2196f3;
}
.log-system {
  border-left-color: #607d8b;
}
.log-win {
  border-left-color: #ffd700;
}
.log-death {
  border-left-color: #424242;
}
.log-heal {
  border-left-color: #4caf50;
}

.entry-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.entry-message {
  flex: 1;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
  word-break: break-word;
}

.entry-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.65rem;
  flex-shrink: 0;
  align-self: flex-end;
}

.empty-log {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 2rem 1rem;
  font-style: italic;
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.log-item-enter-active {
  transition: all 0.3s ease;
}

.log-item-leave-active {
  transition: all 0.2s ease;
}

.log-item-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.log-item-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .game-log-container {
    right: 0.5rem;
    bottom: 0.5rem;
    max-width: calc(100vw - 1rem);
  }

  .log-panel {
    width: calc(100vw - 4rem);
    max-width: 280px;
  }

  .log-entries {
    max-height: 180px;
  }
}
</style>
