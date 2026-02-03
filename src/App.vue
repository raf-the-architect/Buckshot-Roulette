<template>
  <div id="buckshot-app" :class="['app-container', { 'game-active': currentScreen === 'game' }]">
    <!-- Loading Screen -->
    <div v-if="!isReady" class="loading-screen">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>

    <!-- Start Screen -->
    <StartScreen 
      v-else-if="currentScreen === 'start'" 
      v-model="playerName" 
      @start-game="onStartGame"
      @create-room="onCreateRoom"
      @join-room="onJoinRoom"
      :class="{ hidden: isStartLeaving }"
    />

    <!-- Lobby Screen -->
    <LobbyView 
      v-else-if="currentScreen === 'lobby'"
      @game-started="onGameStarted"
      @leave="onLeaveLobby"
    />

    <!-- Replay / Game Over Screen -->
    <ReplayScreen 
      v-else-if="currentScreen === 'replay'" 
      :result="gameResult" 
      @play-again="onReplay"
      @quit="onQuit"
    />

    <!-- Phaser Game Container -->
    <div 
      id="phaser-container" 
      v-show="currentScreen === 'game' || currentScreen === 'replay'"
    ></div>


  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';

// Components
import StartScreen from '@/screens/StartScreen.vue';
import ReplayScreen from '@/screens/ReplayScreen.vue';
import LobbyView from '@/components/LobbyView.vue';
import GameHUD from '@/components/GameHUD.vue';

// Stores
const authStore = useAuthStore();
const roomStore = useRoomStore();
const gameStore = useGameStore();
const router = useRouter();
const route = useRoute();

// =========================================================================
// STATE
// =========================================================================
const currentScreen = ref('start');
const playerName = ref('');
const phaserGame = ref(null);
const isReady = ref(false);
const isMultiplayer = ref(false);
const gameResult = ref({
  isWin: false,
  playerName: 'PLAYER'
});
const isStartLeaving = ref(false);

// =========================================================================
// LIFECYCLE
// =========================================================================
onMounted(async () => {
  // Safety timeout - ensure app becomes ready even if something hangs
  const safetyTimeout = setTimeout(() => {
    if (!isReady.value) {
      console.warn('[App] Safety timeout triggered - forcing ready state');
      isReady.value = true;
    }
  }, 8000);

  try {
    // Try to initialize Firebase Auth (optional for single-player)
    await authStore.initAuth();
    
    // Auto sign-in anonymously if not authenticated (for multiplayer)
    if (!authStore.isAuthenticated) {
      try {
        await authStore.signInAnonymous();
      } catch (authErr) {
        console.warn('[App] Anonymous sign-in failed:', authErr.message);
        // Continue anyway - single-player will work
      }
    }
  } catch (err) {
    console.warn('[App] Firebase auth initialization failed:', err.message);
    console.info('[App] Single-player mode will still work');
  }
  
  // Load saved player name or use Firebase display name
  const savedName = localStorage.getItem('buckshot_player_name');
  if (savedName) {
    playerName.value = savedName;
  } else if (authStore.displayName && authStore.displayName !== 'Guest') {
    playerName.value = authStore.displayName;
  }

  // Listen for game-over event from Phaser
  window.addEventListener('game-over', onGameOver);

  // Check for room join from URL (only if auth succeeded)
  if (route.params.code && authStore.isAuthenticated) {
    try {
      await handleJoinFromUrl(route.params.code);
    } catch (joinErr) {
      console.warn('[App] Failed to join room from URL:', joinErr.message);
    }
  }

  clearTimeout(safetyTimeout);
  isReady.value = true;
});

onBeforeUnmount(() => {
  window.removeEventListener('game-over', onGameOver);
  destroyPhaser();
  roomStore.unsubscribeFromRoom();
  gameStore.leaveGame();
});

// =========================================================================
// METHODS
// =========================================================================

/**
 * Handle single-player game start
 */
async function onStartGame({ onSuccess }) {
  const name = playerName.value.trim() || 'PLAYER';
  localStorage.setItem('buckshot_player_name', name);

  isStartLeaving.value = true;
  isMultiplayer.value = false;

  setTimeout(() => {
    currentScreen.value = 'game';
    isStartLeaving.value = false;
    onSuccess?.();
    createPhaser(name);
  }, 600);
}

/**
 * Create a multiplayer room
 */
async function onCreateRoom() {
  // Require auth for multiplayer
  if (!authStore.isAuthenticated) {
    alert('Multiplayer requires Firebase authentication. Please check your Firebase configuration and try again.');
    return;
  }

  try {
    const name = playerName.value.trim() || authStore.displayName;
    localStorage.setItem('buckshot_player_name', name);
    
    if (name !== authStore.displayName) {
      await authStore.updateDisplayName(name);
    }

    await roomStore.createRoom({ maxPlayers: 4 });
    isMultiplayer.value = true;
    currentScreen.value = 'lobby';
  } catch (err) {
    console.error('Failed to create room:', err);
    alert('Failed to create room: ' + err.message);
  }
}

/**
 * Join a multiplayer room
 */
async function onJoinRoom(roomCode) {
  // Require auth for multiplayer
  if (!authStore.isAuthenticated) {
    alert('Multiplayer requires Firebase authentication. Please check your Firebase configuration and try again.');
    return;
  }

  try {
    const name = playerName.value.trim() || authStore.displayName;
    localStorage.setItem('buckshot_player_name', name);
    
    if (name !== authStore.displayName) {
      await authStore.updateDisplayName(name);
    }

    await roomStore.joinRoom(roomCode);
    isMultiplayer.value = true;
    currentScreen.value = 'lobby';
  } catch (err) {
    console.error('Failed to join room:', err);
    alert('Failed to join room: ' + err.message);
  }
}

/**
 * Handle join from URL parameter
 */
async function handleJoinFromUrl(code) {
  try {
    await roomStore.joinRoom(code);
    isMultiplayer.value = true;
    currentScreen.value = 'lobby';
  } catch (err) {
    console.error('Failed to join from URL:', err);
  }
}

/**
 * Handle game started from lobby
 */
function onGameStarted() {
  currentScreen.value = 'game';
  createPhaserMultiplayer();
}

/**
 * Leave lobby
 */
async function onLeaveLobby() {
  await roomStore.leaveRoom();
  isMultiplayer.value = false;
  currentScreen.value = 'start';
}

/**
 * Handle replay
 */
function onReplay() {
  currentScreen.value = 'game';
  destroyPhaser();

  setTimeout(() => {
    if (isMultiplayer.value) {
      createPhaserMultiplayer();
    } else {
      createPhaser(gameResult.value.playerName);
    }
  }, 100);
}

/**
 * Handle quit
 */
function onQuit() {
  destroyPhaser();
  gameStore.leaveGame();
  roomStore.leaveRoom();
  isMultiplayer.value = false;
  currentScreen.value = 'start';
}

/**
 * Handle game over event from Phaser
 */
function onGameOver(event) {
  const { isWin, playerName } = event.detail;
  gameResult.value = { isWin, playerName };
  currentScreen.value = 'replay';
}

/**
 * Create Phaser for single-player
 */
async function createPhaser(name) {
  // Dynamic import of Phaser and GameScene
  const Phaser = (await import('phaser')).default;
  const { GameScene } = await import('@/game/GameScene.js');
  
  const isLandscape = window.innerWidth > window.innerHeight;

  const config = {
    type: Phaser.AUTO,
    scale: {
      mode: isLandscape ? Phaser.Scale.HEIGHT_CONTROLS_WIDTH : Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 360,
      height: 640
    },
    backgroundColor: 'transparent',
    transparent: true,
    parent: 'phaser-container',
    scene: [GameScene]
  };

  phaserGame.value = new Phaser.Game(config);
  phaserGame.value.registry.set('playerName', name);
  phaserGame.value.registry.set('isMultiplayer', false);

  // Shim for GameScene communication
  const gameOverShim = {
    show: (isWin, playerName) => {
      window.dispatchEvent(new CustomEvent('game-over', {
        detail: { isWin, playerName }
      }));
    },
    hide: () => {}
  };
  phaserGame.value.registry.set('gameOverScreen', gameOverShim);
}

/**
 * Create Phaser for multiplayer
 */
async function createPhaserMultiplayer() {
  const Phaser = (await import('phaser')).default;
  const { GameScene } = await import('@/game/GameScene.js');
  
  const isLandscape = window.innerWidth > window.innerHeight;

  const config = {
    type: Phaser.AUTO,
    scale: {
      mode: isLandscape ? Phaser.Scale.HEIGHT_CONTROLS_WIDTH : Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 360,
      height: 640
    },
    backgroundColor: 'transparent',
    transparent: true,
    parent: 'phaser-container',
    scene: [GameScene]
  };

  phaserGame.value = new Phaser.Game(config);
  phaserGame.value.registry.set('playerName', authStore.displayName);
  phaserGame.value.registry.set('isMultiplayer', true);
  phaserGame.value.registry.set('gameStore', gameStore);

  const gameOverShim = {
    show: (isWin, playerName) => {
      window.dispatchEvent(new CustomEvent('game-over', {
        detail: { isWin, playerName }
      }));
    },
    hide: () => {}
  };
  phaserGame.value.registry.set('gameOverScreen', gameOverShim);
}

/**
 * Destroy Phaser instance
 */
function destroyPhaser() {
  if (phaserGame.value) {
    phaserGame.value.destroy(true);
    phaserGame.value = null;
  }
}

// Watch for multiplayer game end
watch(() => gameStore.currentGame?.status, (status) => {
  if (status === 'ended' && isMultiplayer.value) {
    const winner = gameStore.currentGame?.winner;
    gameResult.value = {
      isWin: winner?.userId === authStore.userId,
      playerName: authStore.displayName
    };
    currentScreen.value = 'replay';
  }
});

// Watch for room status to start game (for clients and host sync)
import { ROOM_STATUS } from '@/utils/constants';

watch(() => roomStore.currentRoom?.status, (status) => {
  if (status === ROOM_STATUS.PLAYING && currentScreen.value === 'lobby') {
    console.log('[App] Room status changed to PLAYING. Starting game...');
    onGameStarted();
  }
});
</script>

<style>
.app-container {
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-left-color: #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

#phaser-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}
</style>
