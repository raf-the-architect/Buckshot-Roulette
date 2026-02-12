<template>
  <div
    class="player-card bb-panel"
    :class="{
      'is-host': player.isHost,
      'is-me': isMe,
      'is-ready': player.isReady
    }"
  >
    <div class="player-avatar">
      <div class="avatar-circle">
        {{ getInitial }}
      </div>
      <div v-if="player.isHost" class="host-badge">👑</div>
      <div v-if="player.isReady" class="ready-badge">✓</div>
    </div>

    <div class="player-info">
      <span class="player-name">
        {{ player.displayName }}
        <span v-if="isMe" class="you-tag">(You)</span>
      </span>
      <span class="player-status" :class="{ ready: player.isReady }">
        {{ player.isReady ? 'Ready' : 'Not Ready' }}
      </span>
    </div>

    <button
      v-if="isHost && !isMe"
      @click="$emit('kick')"
      class="btn-kick"
      title="Kick player"
      type="button"
    >
      ×
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  player: {
    type: Object,
    required: true
  },
  isHost: {
    type: Boolean,
    default: false
  },
  isMe: {
    type: Boolean,
    default: false
  }
});

defineEmits(['kick']);

const getInitial = computed(() => {
  return props.player.displayName?.charAt(0).toUpperCase() || '?';
});
</script>

<style scoped>
.player-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  position: relative;
  border-width: 2px;
  transition: transform 130ms ease;
}

.player-card:hover {
  transform: translateY(-2px);
}

.player-card.is-me {
  border-color: rgba(54, 124, 203, 0.8);
}

.player-card.is-ready {
  box-shadow: 0 12px 24px rgba(16, 74, 137, 0.22), inset 0 0 0 2px rgba(86, 201, 122, 0.44);
}

.player-avatar {
  position: relative;
}

.avatar-circle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(180deg, #8fd6ff 0%, #4d94dd 100%);
  color: #f7fbff;
  border: 2px solid rgba(35, 86, 142, 0.54);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--bb-font-display);
  font-size: 1.36rem;
}

.host-badge {
  position: absolute;
  top: -6px;
  right: -7px;
  font-size: 1rem;
}

.ready-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(180deg, #7fdc95 0%, #49b467 100%);
  border: 1px solid rgba(28, 106, 53, 0.56);
  font-size: 0.72rem;
  font-weight: 800;
}

.player-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.player-name {
  color: var(--bb-blue-900);
  font-family: var(--bb-font-display);
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.you-tag {
  color: var(--bb-orange-900);
  font-size: 0.78rem;
  margin-left: 0.2rem;
}

.player-status {
  color: var(--bb-text-secondary);
  font-size: 0.84rem;
  font-weight: 600;
}

.player-status.ready {
  color: var(--bb-success);
}

.btn-kick {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(180deg, #f79f8e 0%, #d96455 100%);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 0 rgba(116, 44, 37, 0.75);
  line-height: 1;
}

.btn-kick:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(116, 44, 37, 0.75);
}
</style>
