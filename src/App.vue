<template>
  <div id="bang-or-blank-app" :class="['app-container', { 'game-active': currentScreen === 'game' }]">
    <!-- Loading Screen -->
    <div v-if="!isReady" class="loading-screen">
      <div class="loading-card bb-panel">
        <BrandLogo variant="hero" size="260" />
        <div class="loading-meter">
          <div class="loading-meter__bar"></div>
        </div>
        <p>Loading Bang or Blank...</p>
      </div>
    </div>

    <!-- Start Screen -->
    <StartScreen 
      v-else-if="currentScreen === 'start'" 
      v-model="playerName" 
      :initial-room-code="pendingJoinCode"
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

    <button
      v-if="currentScreen === 'game'"
      class="in-game-settings-btn"
      type="button"
      aria-label="Open game settings"
      @click="showInGameSettings = true"
    >
      ⚙
    </button>

    <SettingsModal
      v-model="showInGameSettings"
      :show-leave-game="canLeaveCurrentMatch"
      @leave-game="onLeaveCurrentMatch"
    />

    <div v-if="showStartSyncOverlay" class="start-sync-overlay">
      <div class="start-sync-card">
        <div v-if="startSyncPhase === 'loading'" class="loading-spinner start-sync-spinner"></div>
        <div v-else-if="startSyncPhase === 'countdown'" class="start-sync-countdown">
          {{ countdownRemaining }}
        </div>
        <h2 class="start-sync-title">{{ startSyncTitle }}</h2>
        <p v-if="startSyncSubtitle" class="start-sync-subtitle">{{ startSyncSubtitle }}</p>
        <ul v-if="startSyncPlayerStatuses.length" class="start-sync-player-list">
          <li
            v-for="player in startSyncPlayerStatuses"
            :key="player.userId"
            class="start-sync-player-row"
          >
            <span class="start-sync-player-indicator" :class="{ ready: player.isReady }">
              {{ player.isReady ? '✓' : '○' }}
            </span>
            <span class="start-sync-player-name">{{ player.name }}</span>
          </li>
        </ul>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { createLogger } from '@/utils/logger';
import { MAX_PLAYERS, MIN_PLAYERS, ROOM_STATUS } from '@/utils/constants';

// Components
import StartScreen from '@/screens/StartScreen.vue';
import ReplayScreen from '@/screens/ReplayScreen.vue';
import LobbyView from '@/components/LobbyView.vue';
import BrandLogo from '@/components/ui/BrandLogo.vue';
import SettingsModal from '@/components/SettingsModal.vue';
import { registerServiceWorker } from '@/utils/pwa';

// Stores
const authStore = useAuthStore();
const roomStore = useRoomStore();
const gameStore = useGameStore();
const route = useRoute();
const router = useRouter();
const logger = createLogger('App');

// =========================================================================
// STATE
// =========================================================================
const currentScreen = ref('start');
const playerName = ref('');
const pendingJoinCode = ref('');
const phaserGame = ref(null);
const isReady = ref(false);
const isMultiplayer = ref(false);
const gameResult = ref({
  isWin: false,
  playerName: 'PLAYER'
});
const isStartLeaving = ref(false);
const isBootingMultiplayerGame = ref(false);
const showInGameSettings = ref(false);
const syncNow = ref(Date.now());
const viewportCleanup = [];
let syncTicker = null;
let disposePwa = null;
const MAX_RENDER_DPR = 2;
const PLAYER_NAME_STORAGE_KEY = 'bang_or_blank_player_name';
const ACTIVE_ROOM_STORAGE_KEY = 'bang_or_blank_active_room';
const LEGACY_PLAYER_NAME_STORAGE_KEY = 'buckshot_player_name';
const LEGACY_ACTIVE_ROOM_STORAGE_KEY = 'buckshot_active_room';

function getCappedDevicePixelRatio() {
  return Math.min(MAX_RENDER_DPR, Math.max(1, window.devicePixelRatio || 1));
}

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    width: Math.max(320, Math.round(vv?.width || window.innerWidth || 360)),
    height: Math.max(480, Math.round(vv?.height || window.innerHeight || 640))
  };
}

function updateViewportMetrics() {
  const { width, height } = getViewportSize();
  document.documentElement.style.setProperty('--app-width', `${width}px`);
  document.documentElement.style.setProperty('--app-height', `${height}px`);

  if (phaserGame.value?.scale) {
    phaserGame.value.scale.resize(width, height);
  }
}

function registerViewportListeners() {
  const add = (target, event, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(event, handler, options);
    viewportCleanup.push(() => target.removeEventListener(event, handler, options));
  };

  add(window, 'resize', updateViewportMetrics, { passive: true });
  add(window, 'orientationchange', updateViewportMetrics, { passive: true });
  add(window.visualViewport, 'resize', updateViewportMetrics, { passive: true });
  add(window.visualViewport, 'scroll', updateViewportMetrics, { passive: true });
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') {
    return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1_000_000);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizePlayerName(value) {
  return String(value || '').trim().slice(0, 12);
}

function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().slice(0, 6);
}

function rememberPlayerName(value) {
  const normalized = normalizePlayerName(value);
  if (!normalized) return '';
  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalized);
  playerName.value = normalized;
  return normalized;
}

function rememberActiveRoom(roomCode) {
  const normalized = normalizeRoomCode(roomCode);
  if (!normalized) return '';
  localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, normalized);
  pendingJoinCode.value = normalized;
  return normalized;
}

function clearActiveRoom() {
  localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  pendingJoinCode.value = normalizeRoomCode(route.params.code);
}

function migrateLegacyLocalState() {
  const migrated = {
    playerName: '',
    activeRoomCode: ''
  };

  const currentPlayer = normalizePlayerName(localStorage.getItem(PLAYER_NAME_STORAGE_KEY));
  if (currentPlayer) {
    migrated.playerName = currentPlayer;
  } else {
    const legacyPlayer = normalizePlayerName(localStorage.getItem(LEGACY_PLAYER_NAME_STORAGE_KEY));
    if (legacyPlayer) {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, legacyPlayer);
      localStorage.removeItem(LEGACY_PLAYER_NAME_STORAGE_KEY);
      migrated.playerName = legacyPlayer;
    }
  }

  const currentRoom = normalizeRoomCode(localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY));
  if (currentRoom) {
    migrated.activeRoomCode = currentRoom;
  } else {
    const legacyRoom = normalizeRoomCode(localStorage.getItem(LEGACY_ACTIVE_ROOM_STORAGE_KEY));
    if (legacyRoom) {
      localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, legacyRoom);
      localStorage.removeItem(LEGACY_ACTIVE_ROOM_STORAGE_KEY);
      migrated.activeRoomCode = legacyRoom;
    }
  }

  return migrated;
}

async function ensureJoinRoute(roomCode, replace = true) {
  const normalized = normalizeRoomCode(roomCode);
  if (!normalized) return;

  const currentCode = normalizeRoomCode(route.params.code);
  if (currentCode === normalized) return;

  const target = { name: 'Join', params: { code: normalized } };
  try {
    if (replace) {
      await router.replace(target);
    } else {
      await router.push(target);
    }
  } catch (err) {
    logger.debug('join_route_sync_failed', {
      roomCode: normalized,
      error: err?.message || String(err)
    });
  }
}

async function ensureHomeRoute(replace = true) {
  if (!route.params.code) return;
  try {
    if (replace) {
      await router.replace({ name: 'Home' });
    } else {
      await router.push({ name: 'Home' });
    }
  } catch (err) {
    logger.debug('home_route_sync_failed', { error: err?.message || String(err) });
  }
}

async function syncMultiplayerDisplayName(name) {
  if (name !== authStore.displayName) {
    await authStore.updateDisplayName(name);
  }
}

async function requireMultiplayerPlayerName() {
  const name = normalizePlayerName(playerName.value);
  if (!name) {
    alert('Please enter a player name before creating or joining a room.');
    return null;
  }
  rememberPlayerName(name);
  await syncMultiplayerDisplayName(name);
  return name;
}

const startSyncPhase = computed(() => gameStore.startSync?.phase || null);
const showStartSyncOverlay = computed(() =>
  isMultiplayer.value &&
  currentScreen.value === 'game' &&
  !gameStore.startGateOpen
);
const canLeaveCurrentMatch = computed(() =>
  isMultiplayer.value &&
  currentScreen.value === 'game' &&
  gameStore.isActive &&
  !!gameStore.amAlive
);

const countdownRemaining = computed(() => {
  if (startSyncPhase.value !== 'countdown') {
    return Math.max(1, Number(gameStore.startSync?.countdownSeconds) || 3);
  }
  const seconds = Math.max(1, Number(gameStore.startSync?.countdownSeconds) || 3);
  const startedAtMs = timestampToMillis(gameStore.startSync?.countdownStartedAt);
  if (!startedAtMs) return seconds;
  const remainingMs = Math.max(0, (startedAtMs + (seconds * 1000)) - syncNow.value);
  return Math.max(0, Math.ceil(remainingMs / 1000));
});

const startSyncTitle = computed(() => {
  if (startSyncPhase.value === 'countdown') return 'Get Ready';
  return 'Waiting For Players';
});

const startSyncSubtitle = computed(() => {
  if (startSyncPhase.value === 'countdown') return 'Match starts together for all players';
  return '';
});

const startSyncPlayerStatuses = computed(() => {
  if (startSyncPhase.value !== 'loading') return [];
  const players = gameStore.currentGame?.players || [];
  const loadedBy = gameStore.startSync?.loadingReadyBy || {};

  return players.map((player, index) => ({
    userId: player.userId || `player-${index}`,
    name: player.displayName || `Player ${index + 1}`,
    isReady: !!loadedBy[player.userId]
  }));
});

// =========================================================================
// LIFECYCLE
// =========================================================================
onMounted(async () => {
  updateViewportMetrics();
  registerViewportListeners();
  disposePwa = registerServiceWorker({
    onNeedRefresh: (applyUpdate) => {
      const shouldReload = window.confirm('A new version of Bang or Blank is available. Reload now?');
      if (shouldReload) {
        applyUpdate();
      }
    }
  });

  // Safety timeout - ensure app becomes ready even if something hangs
  const safetyTimeout = setTimeout(() => {
    if (!isReady.value) {
      logger.warn('bootstrap_timeout', { timeoutMs: 8000 });
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
        logger.warn('anonymous_signin_failed', { error: authErr.message });
        // Continue anyway - single-player will work
      }
    }
  } catch (err) {
    logger.warn('firebase_auth_init_failed', { error: err.message });
    logger.info('single_player_available_without_auth');
  }
  
  const migratedLocalState = migrateLegacyLocalState();

  // Load saved player name only (no auto-generated default prefill).
  const savedName = migratedLocalState.playerName;
  if (savedName) {
    playerName.value = savedName;
  }

  const routeRoomCode = normalizeRoomCode(route.params.code);
  const storedActiveRoomCode = migratedLocalState.activeRoomCode;
  pendingJoinCode.value = routeRoomCode || storedActiveRoomCode;

  // Listen for game-over event from Phaser
  window.addEventListener('game-over', onGameOver);

  // Auto-resume join from URL or last active room when a saved name exists.
  const autoJoinCode = routeRoomCode || storedActiveRoomCode;
  if (autoJoinCode && savedName && authStore.isAuthenticated) {
    try {
      await syncMultiplayerDisplayName(savedName);
      await handleJoinFromUrl(autoJoinCode);
      await ensureJoinRoute(autoJoinCode);
    } catch (joinErr) {
      logger.warn('auto_resume_failed', { roomCode: autoJoinCode, error: joinErr.message });
      if (!routeRoomCode) {
        clearActiveRoom();
      }
    }
  }

  clearTimeout(safetyTimeout);
  isReady.value = true;
});

onBeforeUnmount(() => {
  window.removeEventListener('game-over', onGameOver);
  if (syncTicker) {
    clearInterval(syncTicker);
    syncTicker = null;
  }
  disposePwa?.();
  while (viewportCleanup.length > 0) {
    const dispose = viewportCleanup.pop();
    dispose?.();
  }
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
  const name = normalizePlayerName(playerName.value);
  if (!name) {
    onSuccess?.();
    return;
  }

  rememberPlayerName(name);

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
    const name = await requireMultiplayerPlayerName();
    if (!name) return;

    const createdRoomCode = await roomStore.createRoom({ maxPlayers: MAX_PLAYERS });
    rememberActiveRoom(createdRoomCode);
    await ensureJoinRoute(createdRoomCode);
    isMultiplayer.value = true;
    currentScreen.value = 'lobby';
  } catch (err) {
    logger.error('create_room_failed', { error: err.message });
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
    const name = await requireMultiplayerPlayerName();
    if (!name) return;

    const normalizedCode = normalizeRoomCode(roomCode);
    await roomStore.joinRoom(normalizedCode);
    rememberActiveRoom(normalizedCode);
    await ensureJoinRoute(normalizedCode);
    isMultiplayer.value = true;
    currentScreen.value = 'lobby';
  } catch (err) {
    logger.error('join_room_failed', { error: err.message });
    alert('Failed to join room: ' + err.message);
  }
}

/**
 * Handle join from URL parameter
 */
async function handleJoinFromUrl(code) {
  const normalizedCode = normalizeRoomCode(code);
  if (!normalizedCode) {
    throw new Error('Invalid room code');
  }

  await roomStore.joinRoom(normalizedCode);
  rememberActiveRoom(normalizedCode);
  await ensureJoinRoute(normalizedCode);
  isMultiplayer.value = true;
  currentScreen.value = 'lobby';
}

/**
 * Handle game started from lobby
 */
async function onGameStarted() {
  if (isBootingMultiplayerGame.value) return;
  if (currentScreen.value === 'game' && phaserGame.value) return;

  isBootingMultiplayerGame.value = true;

  try {
    const roomId = roomStore.roomId;
    if (!roomId) {
      throw new Error('Room ID is missing');
    }

    // Ensure subscription is active and game is fully initialized before booting Phaser
    if (!gameStore.currentGame || gameStore.currentGame.roomId !== roomId) {
      logger.info('subscribe_game_non_host', { roomId: roomStore.roomId });
      await gameStore.subscribeToGame(roomId);
    }

    const ready = await waitForGameReady(roomId, 10000);
    if (!ready) {
      throw new Error('Game state did not sync in time');
    }

    if (phaserGame.value) {
      destroyPhaser();
    }

    currentScreen.value = 'game';
    await createPhaserMultiplayer();
  } catch (err) {
    logger.error('multiplayer_boot_failed', { error: err.message });
    currentScreen.value = 'lobby';
    const extra = gameStore.error ? `\n${gameStore.error}` : '';
    alert(`Failed to sync game state.${extra}`);
  } finally {
    isBootingMultiplayerGame.value = false;
  }
}

/**
 * Wait for multiplayer game state to be fully available
 */
async function waitForGameReady(roomId, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const game = gameStore.currentGame;
    const playerCount = Array.isArray(game?.players) ? game.players.length : 0;
    const hasCore =
      game &&
      (game.roomId === roomId || game.gameId === roomId) &&
      game.status === 'active' &&
      !!game.matchId &&
      Array.isArray(game.players) &&
      playerCount >= MIN_PLAYERS &&
      playerCount <= MAX_PLAYERS &&
      game.players.some(p => p.userId === authStore.userId) &&
      game.startSync &&
      game.shotgun &&
      Array.isArray(game.shotgun.chamber) &&
      game.shotgun.chamber.length > 0;

    const hasItems =
      hasCore &&
      game.players.every(p => Array.isArray(p.items));

    if (hasItems) return true;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  return false;
}

/**
 * Leave lobby
 */
async function onLeaveLobby() {
  showInGameSettings.value = false;
  await roomStore.leaveRoom();
  clearActiveRoom();
  await ensureHomeRoute();
  isMultiplayer.value = false;
  currentScreen.value = 'start';
}

/**
 * Leave current active match without stopping the game for others.
 * Marks local player as eliminated and keeps match running.
 */
async function onLeaveCurrentMatch() {
  if (!canLeaveCurrentMatch.value) {
    showInGameSettings.value = false;
    return;
  }

  try {
    await gameStore.leaveMatchAsDead();
  } catch (err) {
    logger.error('leave_current_match_failed', { error: err.message });
    alert('Failed to leave current match: ' + err.message);
  } finally {
    showInGameSettings.value = false;
  }
}

/**
 * Handle replay
 */
async function onReplay() {
  showInGameSettings.value = false;
  destroyPhaser();

  if (!isMultiplayer.value) {
    currentScreen.value = 'game';
    setTimeout(() => {
      createPhaser(gameResult.value.playerName);
    }, 100);
    return;
  }

  // Clear ended game state first to prevent instant replay modal loop
  gameStore.leaveGame();

  if (roomStore.isHost) {
    try {
      await gameStore.startGame();
      await onGameStarted();
    } catch (err) {
      logger.error('multiplayer_restart_failed', { error: err.message });
      alert('Failed to restart game: ' + err.message);
      currentScreen.value = 'lobby';
    }
    return;
  }

  // Guest waits in lobby for host restart
  currentScreen.value = 'lobby';
}

/**
 * Handle quit
 */
async function onQuit() {
  showInGameSettings.value = false;
  destroyPhaser();
  gameStore.leaveGame();
  try {
    await roomStore.leaveRoom();
  } catch (err) {
    logger.warn('quit_leave_room_failed', { error: err.message });
  }
  clearActiveRoom();
  await ensureHomeRoute();
  isMultiplayer.value = false;
  currentScreen.value = 'start';
}

/**
 * Handle game over event from Phaser
 */
function onGameOver(event) {
  showInGameSettings.value = false;
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
  const viewport = getViewportSize();
  const gameOverShim = {
    show: (isWin, playerName) => {
      window.dispatchEvent(new CustomEvent('game-over', {
        detail: { isWin, playerName }
      }));
    },
    hide: () => {}
  };
  
  const config = {
    type: Phaser.AUTO,
    resolution: getCappedDevicePixelRatio(),
    antialias: true,
    pixelArt: false,
    render: {
      antialias: true,
      roundPixels: false
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: viewport.width,
      height: viewport.height
    },
    backgroundColor: 'transparent',
    transparent: true,
    parent: 'phaser-container',
    scene: [GameScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set('playerName', name);
        game.registry.set('isMultiplayer', false);
        game.registry.set('gameOverScreen', gameOverShim);
      }
    }
  };

  phaserGame.value = new Phaser.Game(config);
  updateViewportMetrics();
}

/**
 * Create Phaser for multiplayer
 */
async function createPhaserMultiplayer() {
  const Phaser = (await import('phaser')).default;
  const { GameScene } = await import('@/game/GameScene.js');
  const viewport = getViewportSize();
  const gameOverShim = {
    show: (isWin, playerName) => {
      window.dispatchEvent(new CustomEvent('game-over', {
        detail: { isWin, playerName }
      }));
    },
    hide: () => {}
  };
  
  const config = {
    type: Phaser.AUTO,
    resolution: getCappedDevicePixelRatio(),
    antialias: true,
    pixelArt: false,
    render: {
      antialias: true,
      roundPixels: false
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: viewport.width,
      height: viewport.height
    },
    backgroundColor: 'transparent',
    transparent: true,
    parent: 'phaser-container',
    scene: [GameScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set('playerName', authStore.displayName);
        game.registry.set('isMultiplayer', true);
        game.registry.set('gameStore', gameStore);
        game.registry.set('currentUserId', authStore.userId);
        game.registry.set('gameOverScreen', gameOverShim);
        game.registry.set('onMultiplayerSceneReady', async () => {
          try {
            await gameStore.markStartLoaded();
          } catch (err) {
            logger.warn('mark_start_loaded_failed', { error: err?.message || String(err) });
          }
        });
      }
    }
  };

  phaserGame.value = new Phaser.Game(config);
  updateViewportMetrics();
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
  if (status === 'ended' && isMultiplayer.value && currentScreen.value === 'game') {
    const winner = gameStore.currentGame?.winner;
    gameResult.value = {
      isWin: winner?.userId === authStore.userId,
      playerName: authStore.displayName
    };
    currentScreen.value = 'replay';
  }
});

watch(showStartSyncOverlay, (visible) => {
  if (!visible) {
    if (syncTicker) {
      clearInterval(syncTicker);
      syncTicker = null;
    }
    return;
  }

  syncNow.value = Date.now();
  if (!syncTicker) {
    syncTicker = setInterval(() => {
      syncNow.value = Date.now();
    }, 200);
  }
}, { immediate: true });

// Watch for room status to start game (for clients and host sync)
watch(() => roomStore.currentRoom?.status, (status) => {
  if (status === ROOM_STATUS.PLAYING && currentScreen.value === 'lobby') {
    logger.info('room_status_playing', { roomId: roomStore.roomId });
    onGameStarted();
  }
});

watch(() => currentScreen.value, (screen) => {
  if (screen !== 'game') {
    showInGameSettings.value = false;
  }
});
</script>

<style>
.app-container {
  width: var(--app-width, 100vw);
  height: var(--app-height, 100dvh);
  min-height: var(--app-height, 100dvh);
  overflow: auto;
}

.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  height: var(--app-height, 100dvh);
  background: var(--bb-bg-main);
}

.loading-card {
  width: min(92vw, 440px);
  display: grid;
  justify-items: center;
  gap: 1rem;
  text-align: center;
  color: var(--bb-blue-900);
}

.loading-card p {
  margin: 0;
  font-family: var(--bb-font-display);
  font-size: 1.02rem;
}

.loading-meter {
  width: 100%;
  border-radius: var(--bb-radius-pill);
  border: 2px solid rgba(62, 109, 169, 0.45);
  background: linear-gradient(180deg, #eef6ff 0%, #d3e8ff 100%);
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(26, 62, 111, 0.2);
}

.loading-meter__bar {
  width: 42%;
  height: 14px;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffa63f 0%, #f4861f 100%);
  box-shadow: 0 0 12px rgba(255, 150, 47, 0.55);
  animation: loading-slide 1.05s ease-in-out infinite alternate;
}

.loading-spinner {
  width: 42px;
  height: 42px;
  border: 4px solid rgba(255, 246, 223, 0.35);
  border-left-color: var(--bb-orange-700);
  border-radius: 50%;
  animation: bb-spin 900ms linear infinite;
}

@keyframes loading-slide {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(130%);
  }
}

#phaser-container {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--app-width, 100vw);
  height: var(--app-height, 100dvh);
  min-height: var(--app-height, 100dvh);
  z-index: 0;
}

.in-game-settings-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 0.7rem);
  left: calc(env(safe-area-inset-left, 0px) + 0.7rem);
  width: 46px;
  height: 46px;
  border-radius: 12px;
  border: 2px solid rgba(67, 118, 178, 0.46);
  background: linear-gradient(180deg, rgba(254, 243, 216, 0.96) 0%, rgba(240, 220, 171, 0.96) 100%);
  color: var(--bb-blue-900);
  box-shadow: 0 8px 16px rgba(21, 57, 103, 0.34);
  display: grid;
  place-items: center;
  font-size: 1.32rem;
  cursor: pointer;
  z-index: 18;
}

.in-game-settings-btn:active {
  transform: translateY(1px);
}

.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease;
}

.start-sync-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(19, 53, 96, 0.62);
  backdrop-filter: blur(6px);
  padding: 1rem;
}

.start-sync-card {
  width: min(90vw, 380px);
  border-radius: var(--bb-radius-lg);
  border: 3px solid rgba(72, 112, 162, 0.74);
  background: var(--bb-bg-panel);
  padding: 1.25rem 1rem;
  text-align: center;
  color: var(--bb-blue-900);
  box-shadow: var(--bb-shadow-panel);
}

.start-sync-spinner {
  margin: 0 auto 0.85rem;
  width: 42px;
  height: 42px;
}

.start-sync-countdown {
  width: 64px;
  height: 64px;
  margin: 0 auto 0.7rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--bb-cream-100);
  background: linear-gradient(180deg, #ffb24d 0%, #e8751a 100%);
  border: 2px solid rgba(123, 64, 18, 0.6);
  box-shadow: 0 6px 0 rgba(132, 69, 20, 0.84);
}

.start-sync-title {
  margin: 0;
  font-size: 1.22rem;
  font-weight: 700;
  font-family: var(--bb-font-display);
}

.start-sync-subtitle {
  margin: 0.55rem 0 0.2rem;
  font-size: 0.94rem;
  color: var(--bb-text-secondary);
}

.start-sync-player-list {
  margin: 0.75rem 0 0.1rem;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.4rem;
  text-align: left;
}

.start-sync-player-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.9rem;
  color: var(--bb-blue-900);
  background: rgba(34, 103, 183, 0.08);
  border-radius: var(--bb-radius-sm);
  padding: 0.36rem 0.6rem;
}

.start-sync-player-indicator {
  width: 1.1rem;
  text-align: center;
  color: rgba(30, 82, 145, 0.45);
}

.start-sync-player-indicator.ready {
  color: var(--bb-success);
}

.start-sync-player-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 640px) {
  .in-game-settings-btn {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    font-size: 1.18rem;
  }

  .loading-card {
    gap: 0.8rem;
  }
}
</style>
