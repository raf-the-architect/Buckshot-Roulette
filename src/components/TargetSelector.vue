<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="uiStore.showTargetSelector"
        class="target-overlay"
        @click.self="handleClose"
      >
        <div class="target-modal">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-icon">{{ modeIcon }}</div>
            <h2>{{ modeTitle }}</h2>
            <p class="mode-description">{{ modeDescription }}</p>
          </div>

          <!-- Targets Grid -->
          <div class="targets-grid">
            <!-- Other Players -->
            <button
              v-for="player in validTargets"
              :key="player.userId"
              class="target-card"
              :class="{
                selected: selectedTarget === player.userId,
                current: isCurrentTurn(player),
              }"
              @click="selectTarget(player.userId)"
            >
              <div class="target-avatar">
                <span class="avatar-letter">{{ getInitial(player) }}</span>
                <div v-if="!player.isAlive" class="dead-overlay">☠️</div>
              </div>
              <div class="target-info">
                <span class="target-name">{{ player.displayName }}</span>
                <div class="target-health">
                  <span v-for="h in player.health" :key="h" class="health-pip"
                    >❤️</span
                  >
                  <span
                    v-for="h in maxHealth - player.health"
                    :key="'empty-' + h"
                    class="health-pip empty"
                    >🖤</span
                  >
                </div>
                <div class="target-items" v-if="player.items?.length > 0">
                  <span class="items-count"
                    >{{ player.items.length }} items</span
                  >
                </div>
              </div>
              <div class="select-indicator">
                <span v-if="selectedTarget === player.userId">✓</span>
              </div>
            </button>

            <!-- Self targeting (for shoot mode) -->
            <button
              v-if="canTargetSelf"
              class="target-card self-target"
              :class="{ selected: selectedTarget === 'self' }"
              @click="selectTarget('self')"
            >
              <div class="target-avatar self">
                <span class="avatar-letter">{{ myInitial }}</span>
              </div>
              <div class="target-info">
                <span class="target-name">Yourself</span>
                <div class="target-health">
                  <span
                    v-for="h in myPlayer?.health"
                    :key="h"
                    class="health-pip"
                    >❤️</span
                  >
                </div>
                <span class="self-note">🎲 Blank = Extra turn</span>
              </div>
              <div class="select-indicator">
                <span v-if="selectedTarget === 'self'">✓</span>
              </div>
            </button>
          </div>

          <!-- No Valid Targets Message -->
          <div
            v-if="validTargets.length === 0 && !canTargetSelf"
            class="no-targets"
          >
            <span class="no-targets-icon">🚫</span>
            <p>No valid targets available</p>
          </div>

          <!-- Action Buttons -->
          <div class="modal-actions">
            <button class="btn-cancel" @click="handleClose">Cancel</button>
            <button
              class="btn-confirm"
              :disabled="!selectedTarget"
              @click="confirmSelection"
            >
              <span class="btn-icon">{{ confirmIcon }}</span>
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from "vue";
import { useUIStore } from "@/stores/uiStore";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";

const uiStore = useUIStore();
const gameStore = useGameStore();
const authStore = useAuthStore();

const selectedTarget = ref(null);

// Mode configuration
const modeIcon = computed(() => {
  return uiStore.targetSelectorMode === "shoot" ? "🎯" : "🎁";
});

const modeTitle = computed(() => {
  return uiStore.targetSelectorMode === "shoot"
    ? "Select Target"
    : "Choose Target";
});

const modeDescription = computed(() => {
  return uiStore.targetSelectorMode === "shoot"
    ? "Choose who to aim the shotgun at"
    : "Select a player to use this item on";
});

const confirmIcon = computed(() => {
  return uiStore.targetSelectorMode === "shoot" ? "🔫" : "✨";
});

const confirmText = computed(() => {
  return uiStore.targetSelectorMode === "shoot" ? "Fire!" : "Use Item";
});

// Player data
const myPlayer = computed(() => gameStore.myPlayer);

const myInitial = computed(() => {
  return myPlayer.value?.displayName?.charAt(0)?.toUpperCase() || "?";
});

const maxHealth = computed(() => {
  // Calculate based on current game or default
  return gameStore.currentGame?.initialHealth || 4;
});

const validTargets = computed(() => {
  if (!gameStore.currentGame?.players) return [];

  return gameStore.currentGame.players.filter((p) => {
    // Filter out self for opponent selection
    if (p.userId === authStore.userId) return false;
    // Filter out dead players
    if (!p.isAlive) return false;
    return true;
  });
});

const canTargetSelf = computed(() => {
  // Only allow self-targeting in shoot mode
  return uiStore.targetSelectorMode === "shoot" && myPlayer.value?.isAlive;
});

// Helper functions
function getInitial(player) {
  return player.displayName?.charAt(0)?.toUpperCase() || "?";
}

function isCurrentTurn(player) {
  return gameStore.currentGame?.currentPlayerId === player.userId;
}

function selectTarget(targetId) {
  selectedTarget.value = targetId;
}

function handleClose() {
  selectedTarget.value = null;
  uiStore.closeTargetSelector();
}

function confirmSelection() {
  if (!selectedTarget.value) return;

  uiStore.selectTarget(selectedTarget.value);
  selectedTarget.value = null;
}
</script>

<style scoped>
.target-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.target-modal {
  background: linear-gradient(145deg, #1e1e1e, #121212);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 20px;
  padding: 2rem;
  max-width: 500px;
  width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(255, 215, 0, 0.1);
}

.modal-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.header-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  animation: pulse 2s infinite;
}

.modal-header h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  color: #ffd700;
  font-weight: 700;
}

.mode-description {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

.targets-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.target-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  width: 100%;
}

.target-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
  transform: translateX(5px);
}

.target-card.selected {
  background: rgba(255, 215, 0, 0.15);
  border-color: #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
}

.target-card.current {
  position: relative;
}

.target-card.current::after {
  content: "TURN";
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #4caf50;
  color: white;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
}

.target-card.self-target {
  border-style: dashed;
  border-color: rgba(255, 152, 0, 0.3);
}

.target-card.self-target:hover {
  border-color: rgba(255, 152, 0, 0.6);
}

.target-card.self-target.selected {
  background: rgba(255, 152, 0, 0.15);
  border-color: #ff9800;
}

.target-avatar {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a4a4a, #2a2a2a);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid rgba(255, 215, 0, 0.3);
}

.target-avatar.self {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

.avatar-letter {
  font-size: 1.4rem;
  font-weight: bold;
  color: #ffd700;
}

.target-avatar.self .avatar-letter {
  color: white;
}

.dead-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.target-info {
  flex: 1;
  min-width: 0;
}

.target-name {
  display: block;
  font-weight: 600;
  color: #fff;
  font-size: 1rem;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.target-health {
  display: flex;
  gap: 2px;
  margin-bottom: 0.25rem;
}

.health-pip {
  font-size: 0.9rem;
}

.health-pip.empty {
  opacity: 0.4;
}

.target-items {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.items-count {
  background: rgba(156, 39, 176, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
}

.self-note {
  display: block;
  font-size: 0.75rem;
  color: #ff9800;
  margin-top: 0.25rem;
}

.select-indicator {
  width: 30px;
  height: 30px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1rem;
  color: #4caf50;
  transition: all 0.2s ease;
}

.target-card.selected .select-indicator {
  background: #4caf50;
  border-color: #4caf50;
  color: white;
}

.no-targets {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.5);
}

.no-targets-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-cancel,
.btn-confirm {
  padding: 0.75rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.btn-confirm {
  background: linear-gradient(135deg, #f44336, #c62828);
  color: white;
  box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4);
}

.btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #e53935, #b71c1c);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(244, 67, 54, 0.5);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-icon {
  font-size: 1.2rem;
}

/* Transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .target-modal,
.modal-leave-to .target-modal {
  transform: scale(0.9) translateY(20px);
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
  .target-modal {
    padding: 1.5rem;
    border-radius: 16px;
  }

  .modal-header h2 {
    font-size: 1.25rem;
  }

  .header-icon {
    font-size: 2.5rem;
  }

  .target-card {
    padding: 0.75rem;
  }

  .target-avatar {
    width: 42px;
    height: 42px;
  }

  .modal-actions {
    flex-direction: column;
  }

  .btn-cancel,
  .btn-confirm {
    width: 100%;
    justify-content: center;
  }
}
</style>
