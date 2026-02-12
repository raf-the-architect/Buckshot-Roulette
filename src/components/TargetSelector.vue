<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="uiStore.showTargetSelector"
        class="target-overlay"
        @click.self="handleClose"
      >
        <div class="target-modal bb-modal">
          <div class="modal-header">
            <div class="header-icon">{{ modeIcon }}</div>
            <h2>{{ modeTitle }}</h2>
            <p class="mode-description">{{ modeDescription }}</p>
          </div>

          <div class="targets-grid">
            <button
              v-for="player in validTargets"
              :key="player.userId"
              class="target-card"
              :class="{
                selected: selectedTarget === player.userId,
                current: isCurrentTurn(player),
              }"
              @click="selectTarget(player.userId)"
              type="button"
            >
              <div class="target-avatar">
                <span class="avatar-letter">{{ getInitial(player) }}</span>
                <div v-if="!player.isAlive" class="dead-overlay">☠️</div>
              </div>
              <div class="target-info">
                <span class="target-name">{{ player.displayName }}</span>
                <div class="target-health">
                  <span v-for="h in player.health" :key="h" class="health-pip">❤️</span>
                  <span
                    v-for="h in maxHealth - player.health"
                    :key="'empty-' + h"
                    class="health-pip empty"
                  >🖤</span>
                </div>
                <div class="target-items" v-if="player.items?.length > 0">
                  <span class="items-count">{{ player.items.length }} items</span>
                </div>
              </div>
              <div class="select-indicator">
                <span v-if="selectedTarget === player.userId">✓</span>
              </div>
            </button>

            <button
              v-if="canTargetSelf"
              class="target-card self-target"
              :class="{ selected: selectedTarget === 'self' }"
              @click="selectTarget('self')"
              type="button"
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
                  >❤️</span>
                </div>
                <span class="self-note">Blank shell still gives an extra turn</span>
              </div>
              <div class="select-indicator">
                <span v-if="selectedTarget === 'self'">✓</span>
              </div>
            </button>
          </div>

          <div
            v-if="validTargets.length === 0 && !canTargetSelf"
            class="no-targets"
          >
            <span class="no-targets-icon">🚫</span>
            <p>No valid targets available</p>
          </div>

          <div class="modal-actions">
            <button class="bb-btn bb-btn--ghost" type="button" @click="handleClose">Cancel</button>
            <button
              class="bb-btn bb-btn--primary"
              :disabled="!selectedTarget"
              type="button"
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
import { ref, computed } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';

const uiStore = useUIStore();
const gameStore = useGameStore();
const authStore = useAuthStore();

const selectedTarget = ref(null);

const modeIcon = computed(() => {
  return uiStore.targetSelectorMode === 'shoot' ? '🎯' : '🎁';
});

const modeTitle = computed(() => {
  return uiStore.targetSelectorMode === 'shoot'
    ? 'Select Target'
    : 'Choose Target';
});

const modeDescription = computed(() => {
  return uiStore.targetSelectorMode === 'shoot'
    ? 'Choose who to aim the shotgun at'
    : 'Select a player to use this item on';
});

const confirmIcon = computed(() => {
  return uiStore.targetSelectorMode === 'shoot' ? '🔫' : '✨';
});

const confirmText = computed(() => {
  return uiStore.targetSelectorMode === 'shoot' ? 'Fire!' : 'Use Item';
});

const myPlayer = computed(() => gameStore.myPlayer);

const myInitial = computed(() => {
  return myPlayer.value?.displayName?.charAt(0)?.toUpperCase() || '?';
});

const maxHealth = computed(() => {
  return gameStore.currentGame?.initialHealth || 4;
});

const validTargets = computed(() => {
  if (!gameStore.currentGame?.players) return [];

  return gameStore.currentGame.players.filter((p) => {
    if (p.userId === authStore.userId) return false;
    if (!p.isAlive) return false;
    return true;
  });
});

const canTargetSelf = computed(() => {
  return uiStore.targetSelectorMode === 'shoot' && myPlayer.value?.isAlive;
});

function getInitial(player) {
  return player.displayName?.charAt(0)?.toUpperCase() || '?';
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
  inset: 0;
  background: rgba(18, 51, 94, 0.66);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
  padding: 1rem;
}

.target-modal {
  max-width: 520px;
  width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: 1rem;
}

.modal-header {
  text-align: center;
  margin-bottom: 1rem;
}

.header-icon {
  font-size: 2.5rem;
  margin-bottom: 0.2rem;
}

.modal-header h2 {
  margin: 0;
  color: var(--bb-blue-900);
  font-family: var(--bb-font-display);
}

.mode-description {
  margin: 0.3rem 0 0;
  color: var(--bb-text-secondary);
  font-size: 0.9rem;
}

.targets-grid {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.target-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(45, 110, 186, 0.09);
  border: 2px solid rgba(69, 112, 170, 0.34);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.target-card:hover {
  transform: translateY(-1px);
}

.target-card.selected {
  border-color: rgba(232, 126, 29, 0.78);
  background: rgba(244, 134, 31, 0.14);
}

.target-card.current::after {
  content: 'TURN';
  margin-left: auto;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: var(--bb-radius-pill);
  background: rgba(84, 186, 119, 0.28);
  color: #1f7d45;
}

.target-card.self-target {
  border-style: dashed;
}

.target-avatar {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(180deg, #8fd6ff 0%, #4d94dd 100%);
  border: 2px solid rgba(37, 87, 143, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.target-avatar.self {
  background: linear-gradient(180deg, #ffbe61 0%, #f4861f 100%);
  border-color: rgba(142, 72, 18, 0.52);
}

.avatar-letter {
  color: #fff;
  font-family: var(--bb-font-display);
  font-size: 1.2rem;
}

.dead-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(23, 32, 48, 0.58);
  display: grid;
  place-items: center;
}

.target-info {
  flex: 1;
  min-width: 0;
}

.target-name {
  display: block;
  color: var(--bb-blue-900);
  font-family: var(--bb-font-display);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.target-health {
  display: flex;
  gap: 2px;
  margin-top: 0.15rem;
}

.health-pip.empty {
  opacity: 0.45;
}

.target-items {
  margin-top: 0.2rem;
}

.items-count {
  color: var(--bb-text-secondary);
  font-size: 0.72rem;
}

.self-note {
  display: block;
  margin-top: 0.15rem;
  color: var(--bb-orange-900);
  font-size: 0.74rem;
}

.select-indicator {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(68, 115, 174, 0.35);
  display: grid;
  place-items: center;
  color: #2a8c50;
}

.target-card.selected .select-indicator {
  background: rgba(68, 183, 108, 0.24);
  border-color: rgba(68, 183, 108, 0.62);
}

.no-targets {
  text-align: center;
  color: var(--bb-text-secondary);
  padding: 1rem;
}

.no-targets-icon {
  font-size: 2rem;
  display: block;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.modal-actions .bb-btn {
  width: 100%;
}

.btn-icon {
  font-size: 1rem;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .modal-actions {
    grid-template-columns: 1fr;
  }
}
</style>
