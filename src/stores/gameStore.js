/**
 * Game Store
 * Manages authoritative multiplayer state and Firebase synchronization.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    collection,
    serverTimestamp,
    query,
    orderBy,
    limit,
    runTransaction
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuthStore } from './authStore';
import { useRoomStore } from './roomStore';
import { ITEMS, TURN_TIME_LIMIT, MIN_PLAYERS, MAX_PLAYERS } from '@/utils/constants';
import { createLogger } from '@/utils/logger';

const logger = createLogger('GameStore');

const START_COUNTDOWN_SECONDS = 3;
const ACTION_QUERY_LIMIT = 100;
const generateMatchId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Convert Firestore timestamp-like values to milliseconds.
 * @param {any} value - Firestore Timestamp, number, or ISO string.
 * @returns {number}
 */
const timestampToMillis = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') {
        return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1_000_000);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Determine if start gate is open for gameplay actions.
 * @param {object | null} game - Game document state.
 * @returns {boolean}
 */
const isStartGateOpenForGame = (game) => {
    const sync = game?.startSync;
    if (!sync) return true;
    return sync.phase === 'ready';
};

/**
 * Calculate initial health from player count.
 * @param {number} playerCount - Number of players.
 * @returns {number}
 */
const calculateInitialHealth = (playerCount) => {
    if (playerCount <= 2) return 4;
    if (playerCount <= 4) return 4;
    return 3;
};

/**
 * Create a shuffled shotgun for a round.
 * @param {number} liveRounds - Number of live rounds.
 * @param {number} blankRounds - Number of blank rounds.
 * @returns {{chamber: string[], liveRounds: number, blankRounds: number, totalRounds: number, isSawedOff: boolean}}
 */
const generateShotgun = (liveRounds, blankRounds) => {
    const chamber = [];
    for (let i = 0; i < liveRounds; i++) chamber.push('live');
    for (let i = 0; i < blankRounds; i++) chamber.push('blank');

    for (let i = chamber.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chamber[i], chamber[j]] = [chamber[j], chamber[i]];
    }

    return {
        chamber,
        liveRounds,
        blankRounds,
        totalRounds: liveRounds + blankRounds,
        isSawedOff: false
    };
};

/**
 * Grant round items to alive players up to target capacity.
 * @param {Array<object>} players - Player list.
 * @param {number} roundNumber - Current round number.
 * @returns {Array<object>}
 */
const distributeItemsInMemory = (players, roundNumber) => {
    const itemPool = Object.values(ITEMS);
    const itemsPerPlayer = Math.min(2 + Math.floor(roundNumber / 2), 5);

    return players.map((player) => {
        if (!player.isAlive) return player;
        const nextItems = [...(player.items || [])];
        while (nextItems.length < itemsPerPlayer) {
            const randomItem = itemPool[Math.floor(Math.random() * itemPool.length)];
            nextItems.push(randomItem);
        }
        return { ...player, items: nextItems };
    });
};

/**
 * Resolve next alive player's turn, applying stacked handcuff skips.
 * @param {Array<object>} players - Player list.
 * @param {number} currentTurn - Current turn index.
 * @returns {{nextTurn: number, skippedPlayers: Array<{userId: string, remaining: number}>}}
 */
const resolveNextTurn = (players, currentTurn) => {
    let nextTurn = currentTurn;
    let attempts = 0;
    const skippedPlayers = [];

    while (attempts < players.length * 4) {
        nextTurn = (nextTurn + 1) % players.length;
        attempts++;

        const candidate = players[nextTurn];
        if (!candidate?.isAlive) continue;

        const pendingSkips = Math.max(0, Number(candidate.pendingSkipTurns || 0));
        if (pendingSkips > 0) {
            candidate.pendingSkipTurns = pendingSkips - 1;
            skippedPlayers.push({
                userId: candidate.userId,
                remaining: candidate.pendingSkipTurns
            });
            continue;
        }

        return { nextTurn, skippedPlayers };
    }

    return { nextTurn: currentTurn, skippedPlayers };
};

/**
 * Find an alive opponent target for handcuffs.
 * @param {Array<object>} players - Player list.
 * @param {string} actorUserId - Actor user id.
 * @param {string | null} targetPlayerId - Requested target id.
 * @returns {string | null}
 */
const resolveHandcuffTarget = (players, actorUserId, targetPlayerId) => {
    const aliveOpponents = players.filter(
        p => p.isAlive && p.userId !== actorUserId
    );
    if (aliveOpponents.length === 0) return null;

    if (targetPlayerId) {
        const explicit = aliveOpponents.find(p => p.userId === targetPlayerId);
        return explicit ? explicit.userId : null;
    }

    // Auto-pick only when there is exactly one valid opponent.
    if (aliveOpponents.length === 1) {
        return aliveOpponents[0].userId;
    }

    return null;
};

/**
 * Build reset turn context for the next active turn.
 * @param {string} playerId - Next active player id.
 * @returns {object}
 */
const buildTurnContext = (playerId) => ({
    playerId,
    phase: 'item',
    timeRemaining: TURN_TIME_LIMIT,
    selectedItem: null,
    targetPlayerId: null,
    hasShot: false,
    revealedRound: null,
    revealSyncedRound: null
});

export const useGameStore = defineStore('game', () => {
    // =========================================================================
    // STATE
    // =========================================================================
    const currentGame = ref(null);
    const gameActions = ref([]);
    const isLoading = ref(false);
    const error = ref(null);

    const turnTimeRemaining = ref(TURN_TIME_LIMIT);
    const clientRevealPhaseActive = ref(false);

    let turnTimerInterval = null;
    let timeoutActionInFlight = false;
    let startSyncTransitionInFlight = false;
    let startSyncFinalizeInFlight = false;
    let startSyncClockInterval = null;

    let unsubscribeGame = null;
    let unsubscribeActions = null;

    // =========================================================================
    // GETTERS
    // =========================================================================
    const gameId = computed(() => currentGame.value?.gameId);
    const isActive = computed(() => currentGame.value?.status === 'active');

    const currentPlayer = computed(() => {
        const game = currentGame.value;
        if (!game?.players?.length) return null;
        return game.players[game.currentTurn];
    });

    const isMyTurn = computed(() => {
        const authStore = useAuthStore();
        return currentPlayer.value?.userId === authStore.userId;
    });

    const myPlayer = computed(() => {
        const authStore = useAuthStore();
        return currentGame.value?.players?.find(p => p.userId === authStore.userId) || null;
    });

    const startSync = computed(() => currentGame.value?.startSync || null);
    const startGateOpen = computed(() => isStartGateOpenForGame(currentGame.value));
    const hasTurnTimeLimit = computed(() => TURN_TIME_LIMIT > 0);
    const loadedPlayersCount = computed(() => {
        const game = currentGame.value;
        if (!game?.players?.length) return 0;
        const loadedBy = game.startSync?.loadingReadyBy || {};
        return game.players.filter(p => !!loadedBy[p.userId]).length;
    });
    const expectedPlayersCount = computed(() => currentGame.value?.players?.length || 0);

    const amAlive = computed(() => myPlayer.value?.isAlive ?? false);
    const amSpectator = computed(() => !myPlayer.value);

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * Check if local user is host for a given game snapshot.
     * @param {object | null} game - Game snapshot.
     * @returns {boolean}
     */
    const isHostForGame = (game) => {
        const authStore = useAuthStore();
        const roomStore = useRoomStore();
        const userId = authStore.userId;
        if (!game || !userId) return false;
        return roomStore.isHost || game.players?.[0]?.userId === userId;
    };

    /**
     * Return true if all expected players reported scene load completion.
     * @param {object} game - Game snapshot.
     * @returns {boolean}
     */
    const allPlayersLoaded = (game) => {
        if (!game?.players?.length) return false;
        const loadedBy = game.startSync?.loadingReadyBy || {};
        return game.players.every(p => !!loadedBy[p.userId]);
    };

    /**
     * Check if local turn timer is allowed to tick.
     * @param {object | null} game - Game snapshot.
     * @returns {boolean}
     */
    const canRunTurnTimer = (game) => {
        if (TURN_TIME_LIMIT <= 0) return false;
        if (!game) return false;
        if (game.status !== 'active') return false;
        if (!isStartGateOpenForGame(game)) return false;
        if (clientRevealPhaseActive.value) return false;
        return true;
    };

    /**
     * Update remaining turn time from authoritative server turnStartedAt.
     * @returns {number}
     */
    const recalcTurnTimeRemaining = () => {
        if (TURN_TIME_LIMIT <= 0) {
            turnTimeRemaining.value = 0;
            return turnTimeRemaining.value;
        }

        const game = currentGame.value;
        if (!game) {
            turnTimeRemaining.value = TURN_TIME_LIMIT;
            return turnTimeRemaining.value;
        }

        const startedAtMs = timestampToMillis(game.turnStartedAt);
        if (!startedAtMs) {
            turnTimeRemaining.value = TURN_TIME_LIMIT;
            return turnTimeRemaining.value;
        }

        const elapsedSec = Math.floor(Math.max(0, Date.now() - startedAtMs) / 1000);
        turnTimeRemaining.value = Math.max(0, TURN_TIME_LIMIT - elapsedSec);
        return turnTimeRemaining.value;
    };

    /**
     * Stop local turn timer updates.
     */
    const stopTurnTimer = () => {
        if (turnTimerInterval) {
            clearInterval(turnTimerInterval);
            turnTimerInterval = null;
        }
    };

    /**
     * Start local turn timer updates from server turnStartedAt.
     */
    const startTurnTimer = () => {
        stopTurnTimer();

        if (TURN_TIME_LIMIT <= 0) {
            turnTimeRemaining.value = 0;
            return;
        }

        if (!canRunTurnTimer(currentGame.value)) {
            turnTimeRemaining.value = TURN_TIME_LIMIT;
            return;
        }

        recalcTurnTimeRemaining();

        turnTimerInterval = setInterval(() => {
            const remaining = recalcTurnTimeRemaining();
            if (remaining <= 0) {
                void handleTurnTimeout();
            }
        }, 250);
    };

    /**
     * Start or stop the host-side countdown finalization clock.
     * @param {boolean} active - Whether host should finalize countdown.
     */
    const setStartSyncClockActive = (active) => {
        if (active) {
            if (startSyncClockInterval) return;
            startSyncClockInterval = setInterval(() => {
                void maybeFinalizeCountdown(currentGame.value);
            }, 200);
            return;
        }

        if (startSyncClockInterval) {
            clearInterval(startSyncClockInterval);
            startSyncClockInterval = null;
        }
    };

    /**
     * Host transition from `loading` to `countdown` once all players are loaded.
     * @param {object | null} game - Current game snapshot.
     */
    const maybeBeginCountdown = async (game) => {
        if (!game || startSyncTransitionInFlight) return;
        if (!isHostForGame(game)) return;
        if (game.startSync?.phase !== 'loading') return;
        if (!allPlayersLoaded(game)) return;

        startSyncTransitionInFlight = true;
        const gameRef = doc(db, 'games', game.gameId || game.id);

        try {
            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(gameRef);
                if (!snap.exists()) return;

                const freshGame = snap.data();
                const sync = freshGame.startSync;
                if (!sync || sync.phase !== 'loading') return;

                const loadedBy = sync.loadingReadyBy || {};
                const everyoneLoaded = (freshGame.players || []).every(p => !!loadedBy[p.userId]);
                if (!everyoneLoaded) return;

                transaction.update(gameRef, {
                    startSync: {
                        ...sync,
                        phase: 'countdown',
                        countdownStartedAt: serverTimestamp(),
                        countdownSeconds: Math.max(1, Number(sync.countdownSeconds) || START_COUNTDOWN_SECONDS),
                        expectedPlayerIds: (freshGame.players || []).map(p => p.userId)
                    },
                    updatedAt: serverTimestamp()
                });
            });

            logger.info('start_sync_countdown_started', { gameId: game.gameId || game.id });
        } catch (err) {
            logger.warn('start_sync_countdown_failed', { error: err.message });
        } finally {
            startSyncTransitionInFlight = false;
        }
    };

    /**
     * Host transition from `countdown` to `ready` when countdown expires.
     * @param {object | null} game - Current game snapshot.
     */
    const maybeFinalizeCountdown = async (game) => {
        if (!game || startSyncFinalizeInFlight) return;
        if (!isHostForGame(game)) return;

        const sync = game.startSync;
        if (!sync || sync.phase !== 'countdown') return;

        const startedAtMs = timestampToMillis(sync.countdownStartedAt);
        if (!startedAtMs) return;
        const seconds = Math.max(1, Number(sync.countdownSeconds) || START_COUNTDOWN_SECONDS);
        if (Date.now() < startedAtMs + (seconds * 1000)) return;

        startSyncFinalizeInFlight = true;
        const gameRef = doc(db, 'games', game.gameId || game.id);

        try {
            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(gameRef);
                if (!snap.exists()) return;

                const freshGame = snap.data();
                const freshSync = freshGame.startSync;
                if (!freshSync || freshSync.phase !== 'countdown') return;

                transaction.update(gameRef, {
                    startSync: {
                        ...freshSync,
                        phase: 'ready',
                        readyAt: serverTimestamp()
                    },
                    turnStartedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });

            logger.info('start_sync_ready', { gameId: game.gameId || game.id });
        } catch (err) {
            logger.warn('start_sync_finalize_failed', { error: err.message });
        } finally {
            startSyncFinalizeInFlight = false;
        }
    };

    /**
     * Enforce mandatory action preconditions against fresh game snapshot.
     * @param {object} game - Fresh game snapshot.
     * @param {string} userId - Acting user id.
     * @returns {{actorIndex: number, actor: object}}
     */
    const assertActionPreconditions = (game, userId) => {
        if (!game || game.status !== 'active') {
            throw new Error('Game is not active');
        }

        if (!isStartGateOpenForGame(game)) {
            throw new Error('Match is still synchronizing');
        }

        const actorIndex = game.currentTurn;
        const actor = game.players?.[actorIndex];

        if (!actor || actor.userId !== userId) {
            throw new Error('Not your turn');
        }

        if (!actor.isAlive) {
            throw new Error('You are eliminated');
        }

        return { actorIndex, actor };
    };

    /**
     * Build next round shotgun profile from round number.
     * @param {number} nextRound - Next round number.
     * @returns {object}
     */
    const buildShotgunForRound = (nextRound) => {
        const liveCount = Math.min(nextRound + 1, 4);
        const blankCount = Math.min(nextRound + 2, 5);
        return generateShotgun(liveCount, blankCount);
    };

    // =========================================================================
    // PUBLIC ACTIONS
    // =========================================================================

    /**
     * Start a new game from the lobby.
     */
    const startGame = async () => {
        const roomStore = useRoomStore();

        if (!roomStore.isHost) {
            throw new Error('Only host can start game');
        }

        isLoading.value = true;
        error.value = null;

        try {
            const roomId = roomStore.roomId;
            const playerCount = roomStore.roomPlayers.length;

            if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
                throw new Error(`Online mode supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
            }

            const initialHealth = calculateInitialHealth(playerCount);
            const basePlayers = roomStore.roomPlayers.map((player, index) => ({
                userId: player.userId,
                displayName: player.displayName,
                slotIndex: player.slotIndex || index,
                health: initialHealth,
                maxHealth: initialHealth,
                items: [],
                pendingSkipTurns: 0,
                isAlive: true,
                isConnected: true,
                lastActionAt: new Date().toISOString()
            }));

            // Round 1 starts with no items for all players.
            const players = basePlayers;
            const shotgun = generateShotgun(2, 4);
            const matchId = generateMatchId();

            const gameData = {
                gameId: roomId,
                roomId,
                matchId,
                status: 'active',
                createdAt: serverTimestamp(),
                startedAt: serverTimestamp(),
                endedAt: null,
                config: {
                    maxPlayers: roomStore.currentRoom.maxPlayers,
                    itemsEnabled: roomStore.currentRoom.gameSettings.itemsEnabled,
                    turnTimeLimit: TURN_TIME_LIMIT
                },
                currentRound: 1,
                currentTurn: 0,
                turnNumber: 0,
                turnStartedAt: serverTimestamp(),
                phase: 'item',
                shotgun,
                players,
                playerIds: players.map(p => p.userId),
                stateVersion: 0,
                turnContext: buildTurnContext(players[0].userId),
                startSync: {
                    phase: 'loading',
                    countdownSeconds: START_COUNTDOWN_SECONDS,
                    countdownStartedAt: null,
                    loadingReadyBy: {},
                    loadedAtBy: {},
                    expectedPlayerIds: players.map(p => p.userId)
                },
                winner: null,
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, 'games', roomId), gameData);

            await updateDoc(doc(db, 'rooms', roomId), {
                status: 'playing',
                updatedAt: serverTimestamp()
            });

            await subscribeToGame(roomId);

            logger.info('game_started', {
                roomId,
                matchId,
                players: players.map(p => p.userId)
            });
        } catch (err) {
            error.value = err.message;
            logger.error('start_game_failed', { error: err.message });
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Subscribe to game and action feeds.
     * @param {string} nextGameId - Game id.
     */
    const subscribeToGame = async (nextGameId) => {
        unsubscribeFromGame();

        unsubscribeGame = onSnapshot(
            doc(db, 'games', nextGameId),
            (docSnap) => {
                if (!docSnap.exists()) {
                    currentGame.value = null;
                    stopTurnTimer();
                    return;
                }

                const prevGame = currentGame.value;
                currentGame.value = { id: docSnap.id, ...docSnap.data() };

                const game = currentGame.value;
                const matchChanged =
                    !!prevGame?.matchId &&
                    !!game?.matchId &&
                    prevGame.matchId !== game.matchId;
                if (matchChanged) {
                    gameActions.value = [];
                    logger.info('match_context_changed', {
                        previousMatchId: prevGame.matchId,
                        nextMatchId: game.matchId
                    });
                }

                const syncPhase = game.startSync?.phase || null;
                const shouldHostFinalize = syncPhase === 'countdown' && isHostForGame(game);
                setStartSyncClockActive(shouldHostFinalize);

                void maybeBeginCountdown(game);
                void maybeFinalizeCountdown(game);

                if (!canRunTurnTimer(game)) {
                    stopTurnTimer();
                    turnTimeRemaining.value = TURN_TIME_LIMIT;
                } else {
                    const turnChanged = prevGame?.currentTurn !== game.currentTurn;
                    const turnStartChanged =
                        timestampToMillis(prevGame?.turnStartedAt) !== timestampToMillis(game.turnStartedAt);

                    if (turnChanged || turnStartChanged || !turnTimerInterval) {
                        startTurnTimer();
                    }
                }
            },
            (err) => {
                error.value = err.message;
                logger.error('game_subscription_error', { gameId: nextGameId, error: err.message });
            }
        );

        const actionsQuery = query(
            collection(db, 'games', nextGameId, 'actions'),
            orderBy('timestamp', 'desc'),
            limit(ACTION_QUERY_LIMIT)
        );

        unsubscribeActions = onSnapshot(actionsQuery, (snapshot) => {
            const activeMatchId = currentGame.value?.matchId || null;
            const actions = snapshot.docs
                .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
                .filter(action => !activeMatchId || action.matchId === activeMatchId)
                .reverse();

            gameActions.value = actions;
        });
    };

    /**
     * Mark local client scene as fully loaded for synchronized start.
     */
    const markStartLoaded = async () => {
        const authStore = useAuthStore();
        const userId = authStore.userId;
        const game = currentGame.value;
        const id = game?.gameId || game?.id;

        if (!userId || !id) return;

        const sync = game?.startSync;
        if (!sync || sync.phase !== 'loading') return;
        if (sync.loadingReadyBy?.[userId]) {
            void maybeBeginCountdown(game);
            return;
        }

        await updateDoc(doc(db, 'games', id), {
            [`startSync.loadingReadyBy.${userId}`]: true,
            [`startSync.loadedAtBy.${userId}`]: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        logger.info('start_loaded_marked', { gameId: id, userId });

        if (isHostForGame(currentGame.value)) {
            void maybeBeginCountdown(currentGame.value);
        }
    };

    /**
     * Set local reveal phase gate used to pause turn timer during ammo reveal animations.
     * @param {boolean} active - Reveal active flag.
     */
    const setClientRevealPhaseActive = (active) => {
        clientRevealPhaseActive.value = !!active;

        if (clientRevealPhaseActive.value) {
            stopTurnTimer();
            return;
        }

        if (canRunTurnTimer(currentGame.value)) {
            startTurnTimer();
        }
    };

    /**
     * Host-only timer sync: reset turn start once reveal cinematics are complete.
     * This keeps both clients aligned and avoids countdown loss during reveal animations.
     * @param {number} roundNumber - Current revealed round number.
     */
    const syncTurnStartAfterReveal = async (roundNumber) => {
        const game = currentGame.value;
        if (!game || game.status !== 'active') return;
        if (!isStartGateOpenForGame(game)) return;
        if (!isHostForGame(game)) return;

        const id = game.gameId || game.id;
        if (!id) return;

        const gameRef = doc(db, 'games', id);

        try {
            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(gameRef);
                if (!snap.exists()) return;

                const freshGame = snap.data();
                if (freshGame.status !== 'active') return;
                if (!isStartGateOpenForGame(freshGame)) return;
                if (Number(freshGame.currentRound) !== Number(roundNumber)) return;

                const alreadySyncedRound = Number(freshGame.turnContext?.revealSyncedRound);
                if (alreadySyncedRound === Number(roundNumber)) return;

                transaction.update(gameRef, {
                    turnStartedAt: serverTimestamp(),
                    turnContext: {
                        ...(freshGame.turnContext || {}),
                        revealSyncedRound: roundNumber
                    },
                    updatedAt: serverTimestamp()
                });
            });

            logger.debug('turn_timer_synced_after_reveal', { roundNumber });
        } catch (err) {
            logger.warn('turn_timer_sync_after_reveal_failed', {
                roundNumber,
                error: err.message
            });
        }
    };

    /**
     * Apply an item use with transaction-level turn validation.
     * @param {string} itemType - Item key from `ITEMS`.
     * @param {string | null} targetPlayerId - Optional target user id.
     */
    const useItem = async (itemType, targetPlayerId = null) => {
        logger.info('use_item_requested', { itemType, targetPlayerId });

        const authStore = useAuthStore();
        const actorUserId = authStore.userId;
        const id = gameId.value;

        if (!actorUserId || !id) {
            throw new Error('Game is not ready');
        }

        const gameRef = doc(db, 'games', id);
        const actionRef = doc(collection(db, 'games', id, 'actions'));

        const resultSummary = await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error('Game not found');

            const game = gameSnap.data();
            const { actorIndex } = assertActionPreconditions(game, actorUserId);

            const players = (game.players || []).map(p => ({
                ...p,
                items: [...(p.items || [])]
            }));
            const actor = players[actorIndex];

            const ownedIndex = actor.items.indexOf(itemType);
            if (ownedIndex === -1) {
                throw new Error('Item not available');
            }

            const shotgun = {
                ...(game.shotgun || {}),
                chamber: [...(game.shotgun?.chamber || [])]
            };
            const turnContext = { ...(game.turnContext || {}) };
            const stateVersionBefore = Number(game.stateVersion || 0);
            const stateVersionAfter = stateVersionBefore + 1;

            const actorHealthBefore = actor.health;
            const shotgunBefore = {
                chamberLength: shotgun.chamber.length,
                liveRounds: shotgun.liveRounds,
                blankRounds: shotgun.blankRounds,
                isSawedOff: !!shotgun.isSawedOff
            };

            actor.items.splice(ownedIndex, 1);

            const itemResult = {
                actorHealthBefore,
                actorItemsAfter: [...actor.items]
            };

            let resolvedTargetId = null;

            switch (itemType) {
                case ITEMS.HANDCUFFS: {
                    resolvedTargetId = resolveHandcuffTarget(players, actorUserId, targetPlayerId);
                    if (!resolvedTargetId) throw new Error('Target required');
                    const target = players.find(p => p.userId === resolvedTargetId && p.isAlive);
                    if (!target) throw new Error('Target required');
                    const pendingBefore = Math.max(0, Number(target.pendingSkipTurns || 0));
                    target.pendingSkipTurns = pendingBefore + 1;
                    itemResult.targetId = resolvedTargetId;
                    itemResult.targetPendingSkipsBefore = pendingBefore;
                    itemResult.targetPendingSkipsAfter = target.pendingSkipTurns;
                    break;
                }

                case ITEMS.CIGARETTE: {
                    const healed = actor.health < actor.maxHealth;
                    if (healed) {
                        actor.health += 1;
                    }
                    itemResult.healed = healed;
                    itemResult.actorHealthAfter = actor.health;
                    break;
                }

                case ITEMS.BEER: {
                    const ejectedRound = shotgun.chamber.shift() || null;
                    if (ejectedRound === 'live') shotgun.liveRounds = Math.max(0, (shotgun.liveRounds || 0) - 1);
                    if (ejectedRound === 'blank') shotgun.blankRounds = Math.max(0, (shotgun.blankRounds || 0) - 1);
                    itemResult.ejectedRound = ejectedRound;
                    break;
                }

                case ITEMS.MAGNIFYING_GLASS: {
                    const revealedRound = shotgun.chamber[0] || null;
                    turnContext.revealedRound = revealedRound;
                    itemResult.revealedRound = revealedRound;
                    break;
                }

                case ITEMS.KNIFE: {
                    shotgun.isSawedOff = true;
                    itemResult.isSawedOff = true;
                    break;
                }

                default:
                    throw new Error('Unsupported item');
            }

            let nextRoundNumber = game.currentRound;
            let nextTurn = game.currentTurn;
            let nextTurnNumber = game.turnNumber;
            let roundAdvancedOnItem = false;

            // If beer empties chamber, start a new round immediately.
            if (shotgun.chamber.length === 0) {
                roundAdvancedOnItem = true;
                nextRoundNumber = (game.currentRound || 1) + 1;
                const nextShotgun = buildShotgunForRound(nextRoundNumber);
                const nextPlayers = distributeItemsInMemory(players, nextRoundNumber);

                shotgun.chamber = nextShotgun.chamber;
                shotgun.liveRounds = nextShotgun.liveRounds;
                shotgun.blankRounds = nextShotgun.blankRounds;
                shotgun.totalRounds = nextShotgun.totalRounds;
                shotgun.isSawedOff = false;

                // Keep turn owner on item-triggered refill (matches core logic).
                nextTurn = game.currentTurn;
                nextTurnNumber = game.turnNumber;
                turnContext.hasShot = false;
                turnContext.revealedRound = null;
                turnContext.revealSyncedRound = null;
                players.splice(0, players.length, ...nextPlayers);
            }

            itemResult.shotgunBefore = shotgunBefore;
            itemResult.shotgunAfter = {
                chamberLength: shotgun.chamber.length,
                liveRounds: shotgun.liveRounds,
                blankRounds: shotgun.blankRounds,
                isSawedOff: !!shotgun.isSawedOff
            };
            itemResult.actorHealthAfter = actor.health;
            itemResult.turnBefore = game.currentTurn;
            itemResult.turnAfter = nextTurn;
            itemResult.roundBefore = game.currentRound;
            itemResult.roundAfter = nextRoundNumber;

            transaction.update(gameRef, {
                players,
                shotgun,
                currentRound: nextRoundNumber,
                currentTurn: nextTurn,
                turnNumber: nextTurnNumber,
                stateVersion: stateVersionAfter,
                turnContext,
                turnStartedAt: roundAdvancedOnItem ? serverTimestamp() : game.turnStartedAt,
                updatedAt: serverTimestamp()
            });

            transaction.set(actionRef, {
                matchId: game.matchId || null,
                stateVersion: stateVersionAfter,
                type: 'item_use',
                roundNumber: game.currentRound,
                turnNumber: game.turnNumber,
                playerId: actorUserId,
                targetId: resolvedTargetId,
                itemUsed: itemType,
                result: itemResult,
                timestamp: serverTimestamp()
            });

            return {
                matchId: game.matchId || null,
                stateVersionBefore,
                stateVersionAfter,
                itemType,
                actorUserId,
                targetId: resolvedTargetId,
                result: itemResult
            };
        });

        logger.info('use_item_applied', resultSummary);
        logger.debug('use_item_outcome', {
            actorUserId: resultSummary.actorUserId,
            itemType: resultSummary.itemType,
            targetId: resultSummary.targetId || null,
            revealedRound: resultSummary.result?.revealedRound || null,
            ejectedRound: resultSummary.result?.ejectedRound || null,
            actorHealthAfter: resultSummary.result?.actorHealthAfter,
            chamberAfter: resultSummary.result?.shotgunAfter?.chamberLength,
            liveAfter: resultSummary.result?.shotgunAfter?.liveRounds,
            blankAfter: resultSummary.result?.shotgunAfter?.blankRounds,
            turnAfter: resultSummary.result?.turnAfter,
            roundAfter: resultSummary.result?.roundAfter,
            stateVersionAfter: resultSummary.stateVersionAfter
        });
    };

    /**
     * Perform a shoot action with authoritative transaction checks.
     * @param {string} targetPlayerId - Target user id.
     */
    const performShoot = async (targetPlayerId) => {
        logger.info('shoot_requested', { targetPlayerId });

        const authStore = useAuthStore();
        const actorUserId = authStore.userId;
        const id = gameId.value;

        if (!actorUserId || !id) {
            throw new Error('Game is not ready');
        }

        const gameRef = doc(db, 'games', id);
        const roomRef = doc(db, 'rooms', id);
        const actionRef = doc(collection(db, 'games', id, 'actions'));

        const summary = await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error('Game not found');

            const game = gameSnap.data();
            const { actorIndex } = assertActionPreconditions(game, actorUserId);

            const players = (game.players || []).map(p => ({
                ...p,
                items: [...(p.items || [])]
            }));
            const actor = players[actorIndex];

            const targetIndex = players.findIndex(p => p.userId === targetPlayerId);
            if (targetIndex === -1) throw new Error('Target not found');
            const target = players[targetIndex];
            if (!target.isAlive) throw new Error('Target is eliminated');

            const shotgun = {
                ...(game.shotgun || {}),
                chamber: [...(game.shotgun?.chamber || [])]
            };
            const stateVersionBefore = Number(game.stateVersion || 0);
            const stateVersionAfter = stateVersionBefore + 1;
            if (!shotgun.chamber.length) {
                throw new Error('Shotgun is empty');
            }

            const shotgunBefore = {
                chamberLength: shotgun.chamber.length,
                liveRounds: shotgun.liveRounds,
                blankRounds: shotgun.blankRounds,
                isSawedOff: !!shotgun.isSawedOff
            };

            const actorHealthBefore = actor.health;
            const targetHealthBefore = target.health;

            const roundType = shotgun.chamber.shift();
            let damage = roundType === 'live' ? 1 : 0;
            if (roundType === 'live' && shotgun.isSawedOff) damage = 2;

            const killed = [];

            if (damage > 0) {
                target.health = Math.max(0, target.health - damage);
                if (target.health === 0) {
                    target.isAlive = false;
                    killed.push(target.userId);
                }
            }

            if (roundType === 'live') shotgun.liveRounds = Math.max(0, (shotgun.liveRounds || 0) - 1);
            if (roundType === 'blank') shotgun.blankRounds = Math.max(0, (shotgun.blankRounds || 0) - 1);
            shotgun.isSawedOff = false;

            const isSelfShot = targetPlayerId === actorUserId;
            const extraTurn = roundType === 'blank' && isSelfShot;

            let currentRound = game.currentRound;
            let currentTurn = game.currentTurn;
            let turnNumber = game.turnNumber;
            let status = game.status;
            let winner = game.winner || null;
            let endedAt = game.endedAt || null;
            let skippedPlayers = [];

            let turnContext = {
                ...(game.turnContext || {}),
                hasShot: true,
                revealedRound: null
            };

            const alivePlayers = players.filter(p => p.isAlive);
            const gameEnded = alivePlayers.length === 1;
            const chamberEmpty = shotgun.chamber.length === 0;

            if (gameEnded) {
                status = 'ended';
                winner = {
                    userId: alivePlayers[0].userId,
                    displayName: alivePlayers[0].displayName
                };
                endedAt = serverTimestamp();
                transaction.update(roomRef, {
                    status: 'ended',
                    updatedAt: serverTimestamp()
                });
            } else if (chamberEmpty) {
                currentRound = (game.currentRound || 1) + 1;
                const nextShotgun = buildShotgunForRound(currentRound);
                const nextPlayers = distributeItemsInMemory(players, currentRound);

                players.splice(0, players.length, ...nextPlayers);
                shotgun.chamber = nextShotgun.chamber;
                shotgun.liveRounds = nextShotgun.liveRounds;
                shotgun.blankRounds = nextShotgun.blankRounds;
                shotgun.totalRounds = nextShotgun.totalRounds;
                shotgun.isSawedOff = false;

                if (!extraTurn) {
                    const turnResolution = resolveNextTurn(players, game.currentTurn);
                    currentTurn = turnResolution.nextTurn;
                    skippedPlayers = turnResolution.skippedPlayers || [];
                    turnNumber = (game.turnNumber || 0) + 1;
                    turnContext = buildTurnContext(players[currentTurn].userId);
                } else {
                    currentTurn = game.currentTurn;
                    turnNumber = game.turnNumber;
                    turnContext = {
                        ...turnContext,
                        hasShot: false,
                        revealedRound: null,
                        revealSyncedRound: null
                    };
                }
            } else if (!extraTurn) {
                const turnResolution = resolveNextTurn(players, game.currentTurn);
                currentTurn = turnResolution.nextTurn;
                skippedPlayers = turnResolution.skippedPlayers || [];
                turnNumber = (game.turnNumber || 0) + 1;
                turnContext = buildTurnContext(players[currentTurn].userId);
            }

            const result = {
                roundType,
                damage,
                killed,
                extraTurn,
                actorHealthBefore,
                actorHealthAfter: actor.health,
                targetHealthBefore,
                targetHealthAfter: target.health,
                shotgunBefore,
                shotgunAfter: {
                    chamberLength: shotgun.chamber.length,
                    liveRounds: shotgun.liveRounds,
                    blankRounds: shotgun.blankRounds,
                    isSawedOff: !!shotgun.isSawedOff
                },
                turnBefore: game.currentTurn,
                turnAfter: currentTurn,
                roundBefore: game.currentRound,
                roundAfter: currentRound,
                gameEnded,
                skippedPlayers
            };

            const updatePayload = {
                shotgun,
                players,
                currentRound,
                currentTurn,
                turnNumber,
                turnContext,
                stateVersion: stateVersionAfter,
                status,
                winner,
                endedAt,
                updatedAt: serverTimestamp(),
                turnStartedAt: (!extraTurn || chamberEmpty) ? serverTimestamp() : game.turnStartedAt
            };

            transaction.update(gameRef, updatePayload);

            transaction.set(actionRef, {
                matchId: game.matchId || null,
                stateVersion: stateVersionAfter,
                type: 'shoot',
                roundNumber: game.currentRound,
                turnNumber: game.turnNumber,
                playerId: actorUserId,
                targetId: targetPlayerId,
                result,
                timestamp: serverTimestamp()
            });

            return {
                matchId: game.matchId || null,
                stateVersionBefore,
                stateVersionAfter,
                actorUserId,
                targetPlayerId,
                result
            };
        });

        logger.info('shoot_applied', summary);
        logger.debug('shoot_outcome', {
            actorUserId: summary.actorUserId,
            targetUserId: summary.targetPlayerId,
            roundType: summary.result?.roundType,
            damage: summary.result?.damage,
            targetHealthAfter: summary.result?.targetHealthAfter,
            actorHealthAfter: summary.result?.actorHealthAfter,
            chamberAfter: summary.result?.shotgunAfter?.chamberLength,
            liveAfter: summary.result?.shotgunAfter?.liveRounds,
            blankAfter: summary.result?.shotgunAfter?.blankRounds,
            turnAfter: summary.result?.turnAfter,
            roundAfter: summary.result?.roundAfter,
            gameEnded: !!summary.result?.gameEnded,
            stateVersionAfter: summary.stateVersionAfter
        });
    };

    /**
     * Force end current turn safely (used as timeout fallback).
     */
    const endTurn = async () => {
        const authStore = useAuthStore();
        const actorUserId = authStore.userId;
        const id = gameId.value;
        if (!id || !actorUserId) return;

        const gameRef = doc(db, 'games', id);

        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) return;

            const game = gameSnap.data();
            if (game.status !== 'active') return;
            if (!isStartGateOpenForGame(game)) return;

            const current = game.players?.[game.currentTurn];
            if (!current || current.userId !== actorUserId) return;

            const players = (game.players || []).map(p => ({ ...p }));
            const turnResolution = resolveNextTurn(players, game.currentTurn);
            const nextTurn = turnResolution.nextTurn;
            const stateVersionAfter = Number(game.stateVersion || 0) + 1;

            transaction.update(gameRef, {
                currentTurn: nextTurn,
                turnNumber: (game.turnNumber || 0) + 1,
                stateVersion: stateVersionAfter,
                turnStartedAt: serverTimestamp(),
                turnContext: buildTurnContext(players[nextTurn].userId),
                updatedAt: serverTimestamp()
            });
        });

        logger.warn('turn_force_advanced');
    };

    /**
     * Handle local timeout by auto-shooting self for current player.
     */
    const handleTurnTimeout = async () => {
        if (TURN_TIME_LIMIT <= 0) return;
        if (timeoutActionInFlight) return;
        if (!isMyTurn.value) return;

        timeoutActionInFlight = true;
        try {
            const authStore = useAuthStore();
            await performShoot(authStore.userId);
        } catch (err) {
            logger.warn('turn_timeout_action_failed', { error: err.message });
            await endTurn();
        } finally {
            timeoutActionInFlight = false;
        }
    };

    /**
     * Surrender current match by marking the local player as dead.
     * Game continues for remaining players.
     * @returns {Promise<{changed: boolean, gameEnded?: boolean, alreadyDead?: boolean}>}
     */
    const leaveMatchAsDead = async () => {
        const authStore = useAuthStore();
        const actorUserId = authStore.userId;
        const id = gameId.value;

        if (!actorUserId || !id) {
            return { changed: false };
        }

        const gameRef = doc(db, 'games', id);
        const roomRef = doc(db, 'rooms', id);

        const summary = await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) {
                throw new Error('Game not found');
            }

            const game = gameSnap.data();
            if (game.status !== 'active') {
                return { changed: false, gameEnded: true };
            }

            const players = (game.players || []).map(p => ({
                ...p,
                items: [...(p.items || [])]
            }));

            const actorIndex = players.findIndex(p => p.userId === actorUserId);
            if (actorIndex === -1) {
                throw new Error('Player not in game');
            }

            const actor = players[actorIndex];
            if (!actor.isAlive) {
                return { changed: false, alreadyDead: true };
            }

            actor.isAlive = false;
            actor.health = 0;
            actor.items = [];
            actor.pendingSkipTurns = 0;
            actor.lastActionAt = new Date().toISOString();

            const stateVersionAfter = Number(game.stateVersion || 0) + 1;
            const alivePlayers = players.filter(p => p.isAlive);

            let currentTurn = game.currentTurn;
            let turnNumber = game.turnNumber || 0;
            let turnContext = { ...(game.turnContext || {}) };
            let turnStartedAt = game.turnStartedAt;
            let status = game.status;
            let winner = game.winner || null;
            let endedAt = game.endedAt || null;
            let gameEnded = false;

            if (alivePlayers.length <= 1) {
                status = 'ended';
                winner = alivePlayers.length === 1
                    ? {
                        userId: alivePlayers[0].userId,
                        displayName: alivePlayers[0].displayName
                    }
                    : null;
                endedAt = serverTimestamp();
                gameEnded = true;

                transaction.update(roomRef, {
                    status: 'ended',
                    updatedAt: serverTimestamp()
                });
            } else {
                const currentTurnPlayer = players[currentTurn];
                if (!currentTurnPlayer?.isAlive) {
                    const turnResolution = resolveNextTurn(players, currentTurn);
                    currentTurn = turnResolution.nextTurn;
                    turnNumber = (game.turnNumber || 0) + 1;
                    turnContext = buildTurnContext(players[currentTurn].userId);
                    turnStartedAt = serverTimestamp();
                } else if (turnContext.playerId !== currentTurnPlayer.userId) {
                    turnContext = {
                        ...turnContext,
                        playerId: currentTurnPlayer.userId
                    };
                }
            }

            transaction.update(gameRef, {
                players,
                currentTurn,
                turnNumber,
                turnContext,
                turnStartedAt,
                status,
                winner,
                endedAt,
                stateVersion: stateVersionAfter,
                updatedAt: serverTimestamp()
            });

            return {
                changed: true,
                gameEnded,
                actorUserId
            };
        });

        logger.info('leave_match_as_dead_applied', summary);
        return summary;
    };

    /**
     * Leave current game and clear listeners.
     */
    const leaveGame = () => {
        stopTurnTimer();
        setStartSyncClockActive(false);
        unsubscribeFromGame();
        currentGame.value = null;
        gameActions.value = [];
        turnTimeRemaining.value = TURN_TIME_LIMIT;
        clientRevealPhaseActive.value = false;
    };

    /**
     * Unsubscribe active Firebase listeners.
     */
    const unsubscribeFromGame = () => {
        if (unsubscribeGame) {
            unsubscribeGame();
            unsubscribeGame = null;
        }
        if (unsubscribeActions) {
            unsubscribeActions();
            unsubscribeActions = null;
        }
    };

    return {
        // State
        currentGame,
        gameActions,
        isLoading,
        error,
        turnTimeRemaining,
        clientRevealPhaseActive,

        // Getters
        gameId,
        isActive,
        currentPlayer,
        isMyTurn,
        myPlayer,
        startSync,
        startGateOpen,
        hasTurnTimeLimit,
        loadedPlayersCount,
        expectedPlayersCount,
        amAlive,
        amSpectator,

        // Actions
        startGame,
        subscribeToGame,
        markStartLoaded,
        setClientRevealPhaseActive,
        syncTurnStartAfterReveal,
        useItem,
        performShoot,
        endTurn,
        leaveMatchAsDead,
        leaveGame
    };
});
