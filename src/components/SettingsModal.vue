<template>
  <Teleport to="body">
    <Transition name="settings-fade">
      <div v-if="modelValue" class="settings-modal-overlay" @click.self="close">
        <GamePanel class="settings-modal bb-modal" ribbon-text="Settings" tone="alt">
          <template #header>
            <div class="settings-header">
              <BrandLogo variant="badge" size="120" />
              <h2>Game Settings</h2>
            </div>
          </template>

          <section class="settings-section">
            <h3>Audio</h3>

            <div class="settings-toggle-row">
              <GameButton
                size="sm"
                :variant="uiStore.musicEnabled ? 'primary' : 'ghost'"
                @click="uiStore.toggleMusic"
              >
                {{ uiStore.musicEnabled ? 'Music On' : 'Music Off' }}
              </GameButton>
              <GameButton
                size="sm"
                :variant="uiStore.soundEnabled ? 'secondary' : 'ghost'"
                @click="uiStore.toggleSound"
              >
                {{ uiStore.soundEnabled ? 'SFX On' : 'SFX Off' }}
              </GameButton>
            </div>

            <GameSlider
              v-model="musicVolumePercent"
              label="Music Volume"
              :min="0"
              :max="100"
              :step="5"
              suffix="%"
              :disabled="!uiStore.musicEnabled"
            />

            <GameSlider
              v-model="sfxVolumePercent"
              label="Sound Effects"
              :min="0"
              :max="100"
              :step="5"
              suffix="%"
              :disabled="!uiStore.soundEnabled"
            />
          </section>

          <template #footer>
            <div class="settings-actions">
              <GameButton variant="secondary" @click="close">Close</GameButton>
            </div>
          </template>
        </GamePanel>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useUIStore } from '@/stores/uiStore';
import BrandLogo from '@/components/ui/BrandLogo.vue';
import GameButton from '@/components/ui/GameButton.vue';
import GamePanel from '@/components/ui/GamePanel.vue';
import GameSlider from '@/components/ui/GameSlider.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const uiStore = useUIStore();

const musicVolumePercent = computed({
  get: () => Math.round((uiStore.musicVolume || 0) * 100),
  set: (value) => uiStore.setMusicVolume(Number(value || 0) / 100)
});

const sfxVolumePercent = computed({
  get: () => Math.round((uiStore.sfxVolume || 0) * 100),
  set: (value) => uiStore.setSfxVolume(Number(value || 0) / 100)
});

function close() {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.settings-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(18, 47, 89, 0.62);
  backdrop-filter: blur(6px);
}

.settings-modal {
  width: min(94vw, 440px);
  animation: bb-pop 180ms ease;
}

.settings-header {
  display: grid;
  place-items: center;
  gap: 0.35rem;
}

.settings-header h2 {
  margin: 0;
  color: var(--bb-blue-900);
  font-size: 1.4rem;
  font-family: var(--bb-font-display);
}

.settings-section {
  display: grid;
  gap: 0.85rem;
}

.settings-section h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--bb-orange-900);
}

.settings-toggle-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}

.settings-actions {
  display: flex;
}

.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 140ms ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .settings-toggle-row {
    grid-template-columns: 1fr;
  }
}
</style>
