<template>
  <div 
    class="player-card"
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
    >
      ✕
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
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.player-card:hover {
  background: rgba(255, 255, 255, 0.12);
}

.player-card.is-me {
  border-color: #2196F3;
  background: rgba(33, 150, 243, 0.15);
}

.player-card.is-ready {
  border-color: #4CAF50;
}

.player-avatar {
  position: relative;
}

.avatar-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
}

.host-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 1.2rem;
}

.ready-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  background: #4CAF50;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: white;
  font-weight: bold;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.player-name {
  font-weight: 600;
  font-size: 1rem;
  color: white;
}

.you-tag {
  color: #2196F3;
  font-size: 0.8rem;
  font-weight: normal;
}

.player-status {
  font-size: 0.85rem;
  color: #888;
}

.player-status.ready {
  color: #4CAF50;
}

.btn-kick {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
}

.player-card:hover .btn-kick {
  opacity: 1;
}

.btn-kick:hover {
  background: #f44336;
  color: white;
}
</style>
