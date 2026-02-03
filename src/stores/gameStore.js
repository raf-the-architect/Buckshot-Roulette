/**
 * Game Store
 * Manages multiplayer game state and Firebase synchronization
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    doc, setDoc, updateDoc, onSnapshot, collection,
    addDoc, serverTimestamp, query, orderBy, limit
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuthStore } from './authStore';
import { useRoomStore } from './roomStore';
import { ITEMS, TURN_TIME_LIMIT } from '@/utils/constants';

export const useGameStore = defineStore('game', () => {
    // =========================================================================
    // STATE
    // =========================================================================
    const currentGame = ref(null);
    const gameActions = ref([]);
    const isLoading = ref(false);
    const error = ref(null);

    // Turn timer
    const turnTimeRemaining = ref(TURN_TIME_LIMIT);
    let turnTimerInterval = null;

    // Firebase listeners
    let unsubscribeGame = null;
    let unsubscribeActions = null;

    // =========================================================================
    // GETTERS
    // =========================================================================
    const gameId = computed(() => currentGame.value?.gameId);
    const isActive = computed(() => currentGame.value?.status === 'active');

    const currentPlayer = computed(() => {
        if (!currentGame.value) return null;
        return currentGame.value.players[currentGame.value.currentTurn];
    });

    const isMyTurn = computed(() => {
        const authStore = useAuthStore();
        return currentPlayer.value?.userId === authStore.userId;
    });

    const myPlayer = computed(() => {
        const authStore = useAuthStore();
        return currentGame.value?.players.find(p => p.userId === authStore.userId);
    });

    const amAlive = computed(() => myPlayer.value?.isAlive ?? false);
    const amSpectator = computed(() => !myPlayer.value);

    // =========================================================================
    // ACTIONS
    // =========================================================================

    /**
     * Start a new game from the lobby
     */
    const startGame = async () => {
        const roomStore = useRoomStore();
        const authStore = useAuthStore();

        if (!roomStore.isHost) {
            throw new Error('Only host can start game');
        }

        isLoading.value = true;

        try {
            const roomId = roomStore.roomId;
            const playerCount = roomStore.roomPlayers.length;

            // Calculate initial health based on player count
            const initialHealth = calculateInitialHealth(playerCount);

            const players = roomStore.roomPlayers.map((p, index) => ({
                userId: p.userId,
                displayName: p.displayName,
                slotIndex: p.slotIndex || index,
                health: initialHealth,
                maxHealth: initialHealth,
                items: [],
                isAlive: true,
                isConnected: true,
                lastActionAt: new Date().toISOString()
            }));

            // Generate initial shotgun
            const shotgun = generateShotgun(2, 4);

            // Create game document
            const gameData = {
                gameId: roomId,
                roomId,
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
                turnNumber: 0, // Monotonic counter for turn validation
                turnStartedAt: serverTimestamp(),
                phase: 'item',
                shotgun,
                players,
                playerIds: players.map(p => p.userId),
                turnContext: {
                    playerId: players[0].userId,
                    phase: 'item',
                    timeRemaining: TURN_TIME_LIMIT,
                    selectedItem: null,
                    targetPlayerId: null,
                    hasShot: false,
                    skipNextTurn: null,
                    revealedRound: null
                },
                recentActions: [],
                winner: null
            };

            await setDoc(doc(db, 'games', roomId), gameData);

            // Update room status
            await updateDoc(doc(db, 'rooms', roomId), {
                status: 'playing',
                updatedAt: serverTimestamp()
            });

            // Subscribe to game
            await subscribeToGame(roomId);

            // Manually set state to avoid race condition with listener
            currentGame.value = {
                id: roomId,
                ...gameData
            };

            // Give initial items
            await distributeItems(1);

            // Start turn timer
            startTurnTimer();

        } catch (err) {
            error.value = err.message;
            console.error('Error starting game:', err);
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Subscribe to game state updates
     * @param {string} gameId - Game ID to subscribe to
     */
    const subscribeToGame = async (gameId) => {
        unsubscribeFromGame();

        // Subscribe to game document
        unsubscribeGame = onSnapshot(
            doc(db, 'games', gameId),
            (docSnap) => {
                if (docSnap.exists()) {
                    const prevGame = currentGame.value;
                    currentGame.value = { id: docSnap.id, ...docSnap.data() };

                    // Detect turn change and restart timer
                    if (prevGame?.currentTurn !== currentGame.value.currentTurn) {
                        startTurnTimer();
                    }
                }
            },
            (err) => {
                error.value = err.message;
                console.error('Game subscription error:', err);
            }
        );

        // Subscribe to recent actions
        const actionsQuery = query(
            collection(db, 'games', gameId, 'actions'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        unsubscribeActions = onSnapshot(actionsQuery, (snapshot) => {
            gameActions.value = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .reverse();
        });
    };

    /**
     * Start/reset turn timer
     */
    const startTurnTimer = () => {
        clearInterval(turnTimerInterval);
        turnTimeRemaining.value = TURN_TIME_LIMIT;

        turnTimerInterval = setInterval(() => {
            turnTimeRemaining.value--;

            if (turnTimeRemaining.value <= 0) {
                handleTurnTimeout();
            }
        }, 1000);
    };

    /**
     * Handle turn timeout
     */
    const handleTurnTimeout = async () => {
        clearInterval(turnTimerInterval);

        if (!isMyTurn.value) return;

        // Auto-action: shoot self (safest option for timeout)
        try {
            const authStore = useAuthStore();
            await performShoot(authStore.userId);
        } catch (err) {
            console.error('Timeout action failed:', err);
            // Force end turn if shoot fails
            await endTurn();
        }
    };

    /**
     * Use an item
     * @param {string} itemType - Item to use
     * @param {string} targetPlayerId - Target player (for items that need targets)
     */
    const useItem = async (itemType, targetPlayerId = null) => {
        if (!isMyTurn.value || !amAlive.value) return;

        const authStore = useAuthStore();
        const gameRef = doc(db, 'games', gameId.value);

        // Verify player has item
        const player = myPlayer.value;
        if (!player.items.includes(itemType)) {
            throw new Error('Item not available');
        }

        // Remove item from inventory
        const updatedItems = [...player.items];
        updatedItems.splice(updatedItems.indexOf(itemType), 1);

        const updatedPlayers = currentGame.value.players.map(p =>
            p.userId === authStore.userId ? { ...p, items: updatedItems } : p
        );

        let updateData = { players: updatedPlayers };

        // Process item effect
        switch (itemType) {
            case ITEMS.HANDCUFFS:
                if (!targetPlayerId) throw new Error('Target required');
                updateData.turnContext = {
                    ...currentGame.value.turnContext,
                    skipNextTurn: targetPlayerId
                };
                break;

            case ITEMS.CIGARETTE:
                updateData.players = updatedPlayers.map(p =>
                    p.userId === authStore.userId && p.health < p.maxHealth
                        ? { ...p, health: p.health + 1 }
                        : p
                );
                break;

            case ITEMS.BEER:
                const newChamber = [...currentGame.value.shotgun.chamber];
                const ejected = newChamber.shift();
                updateData.shotgun = {
                    ...currentGame.value.shotgun,
                    chamber: newChamber,
                    liveRounds: currentGame.value.shotgun.liveRounds - (ejected === 'live' ? 1 : 0),
                    blankRounds: currentGame.value.shotgun.blankRounds - (ejected === 'blank' ? 1 : 0)
                };
                break;

            case ITEMS.MAGNIFYING_GLASS:
                updateData.turnContext = {
                    ...currentGame.value.turnContext,
                    revealedRound: currentGame.value.shotgun.chamber[0]
                };
                break;

            case ITEMS.KNIFE:
                updateData.shotgun = {
                    ...currentGame.value.shotgun,
                    isSawedOff: true
                };
                break;


        }

        await updateDoc(gameRef, updateData);

        // Log action
        await addDoc(collection(db, 'games', gameId.value, 'actions'), {
            type: 'item_use',
            roundNumber: currentGame.value.currentRound,
            turnNumber: currentGame.value.turnNumber,
            playerId: authStore.userId,
            targetId: targetPlayerId,
            itemUsed: itemType,
            timestamp: serverTimestamp()
        });
    };

    /**
     * Perform a shot
     * @param {string} targetPlayerId - Player to shoot
     */
    const performShoot = async (targetPlayerId) => {
        if (!isMyTurn.value || !amAlive.value) return;

        const authStore = useAuthStore();
        const gameRef = doc(db, 'games', gameId.value);
        const shotgun = currentGame.value.shotgun;

        if (shotgun.chamber.length === 0) {
            throw new Error('Shotgun is empty');
        }

        // Fire current round
        const roundType = shotgun.chamber[0];
        const newChamber = shotgun.chamber.slice(1);

        let damage = roundType === 'live' ? 1 : 0;
        if (shotgun.isSawedOff && roundType === 'live') damage = 2;

        // Apply damage
        let updatedPlayers = [...currentGame.value.players];
        let killedPlayers = [];

        if (damage > 0) {
            updatedPlayers = updatedPlayers.map(p => {
                if (p.userId === targetPlayerId) {
                    const newHealth = p.health - damage;
                    if (newHealth <= 0) {
                        killedPlayers.push(p.userId);
                        return { ...p, health: 0, isAlive: false };
                    }
                    return { ...p, health: newHealth };
                }
                return p;
            });
        }

        // Check for extra turn (blank shot at self)
        const isSelfShot = targetPlayerId === authStore.userId;
        const extraTurn = roundType === 'blank' && isSelfShot;

        // Check for round/game end
        const alivePlayers = updatedPlayers.filter(p => p.isAlive);
        const roundEnded = newChamber.length === 0 || alivePlayers.length === 1;

        let updateData = {
            shotgun: {
                ...shotgun,
                chamber: newChamber,
                liveRounds: shotgun.liveRounds - (roundType === 'live' ? 1 : 0),
                blankRounds: shotgun.blankRounds - (roundType === 'blank' ? 1 : 0),
                isSawedOff: false // Reset after shot
            },
            players: updatedPlayers,
            turnContext: {
                ...currentGame.value.turnContext,
                hasShot: true
            }
        };

        if (roundEnded) {
            if (alivePlayers.length === 1) {
                // Game over
                updateData.status = 'ended';
                updateData.endedAt = serverTimestamp();
                updateData.winner = {
                    userId: alivePlayers[0].userId,
                    displayName: alivePlayers[0].displayName
                };

                // Update room
                await updateDoc(doc(db, 'rooms', gameId.value), {
                    status: 'ended',
                    updatedAt: serverTimestamp()
                });
            } else if (newChamber.length === 0) {
                // Start new round
                const newRound = currentGame.value.currentRound + 1;
                const liveCount = Math.min(newRound + 1, 4);
                const blankCount = Math.min(newRound + 2, 5);

                updateData.currentRound = newRound;
                updateData.shotgun = generateShotgun(liveCount, blankCount);
            }
        }

        await updateDoc(gameRef, updateData);

        // Log action
        await addDoc(collection(db, 'games', gameId.value, 'actions'), {
            type: 'shoot',
            roundNumber: currentGame.value.currentRound,
            turnNumber: currentGame.value.turnNumber,
            playerId: authStore.userId,
            targetId: targetPlayerId,
            result: {
                roundType,
                damage,
                killed: killedPlayers,
                extraTurn
            },
            timestamp: serverTimestamp()
        });

        // End turn (unless extra turn or round ended)
        if (!extraTurn && !roundEnded) {
            await endTurn();
        } else if (roundEnded && alivePlayers.length > 1) {
            // Distribute items for new round
            await distributeItems(currentGame.value.currentRound + 1);
            await endTurn();
        }
    };

    /**
     * End current turn and advance to next player
     */
    const endTurn = async () => {
        const gameRef = doc(db, 'games', gameId.value);
        const players = currentGame.value.players;

        // Find next alive player
        let nextTurn = currentGame.value.currentTurn;
        let attempts = 0;

        do {
            nextTurn = (nextTurn + 1) % players.length;
            attempts++;
        } while (!players[nextTurn].isAlive && attempts < players.length);

        // Check for handcuffs skip
        const nextPlayerId = players[nextTurn].userId;
        if (currentGame.value.turnContext.skipNextTurn === nextPlayerId) {
            // Skip to following player
            do {
                nextTurn = (nextTurn + 1) % players.length;
            } while (!players[nextTurn].isAlive);
        }

        await updateDoc(gameRef, {
            currentTurn: nextTurn,
            turnNumber: currentGame.value.turnNumber + 1,
            turnStartedAt: serverTimestamp(),
            phase: 'item',
            turnContext: {
                playerId: players[nextTurn].userId,
                phase: 'item',
                timeRemaining: TURN_TIME_LIMIT,
                selectedItem: null,
                targetPlayerId: null,
                hasShot: false,
                skipNextTurn: null,
                revealedRound: null
            }
        });
    };

    /**
     * Distribute items to all alive players
     * @param {number} roundNumber - Current round number
     */
    const distributeItems = async (roundNumber) => {
        const gameRef = doc(db, 'games', gameId.value);
        const itemPool = Object.values(ITEMS);
        const itemsPerPlayer = Math.min(2 + Math.floor(roundNumber / 2), 5);

        const updatedPlayers = currentGame.value.players.map(p => {
            if (!p.isAlive) return p;

            const newItems = [...p.items];
            while (newItems.length < itemsPerPlayer) {
                const randomItem = itemPool[Math.floor(Math.random() * itemPool.length)];
                newItems.push(randomItem);
            }

            return { ...p, items: newItems };
        });

        await updateDoc(gameRef, { players: updatedPlayers });
    };

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Calculate initial health based on player count
     */
    const calculateInitialHealth = (playerCount) => {
        if (playerCount <= 2) return 6;
        if (playerCount <= 4) return 4;
        return 3;
    };

    /**
     * Generate a shuffled shotgun chamber
     */
    const generateShotgun = (liveRounds, blankRounds) => {
        const chamber = [];
        for (let i = 0; i < liveRounds; i++) chamber.push('live');
        for (let i = 0; i < blankRounds; i++) chamber.push('blank');

        // Shuffle
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
     * Leave current game
     */
    const leaveGame = () => {
        clearInterval(turnTimerInterval);
        unsubscribeFromGame();
        currentGame.value = null;
        gameActions.value = [];
    };

    /**
     * Unsubscribe from game listeners
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

        // Getters
        gameId,
        isActive,
        currentPlayer,
        isMyTurn,
        myPlayer,
        amAlive,
        amSpectator,

        // Actions
        startGame,
        subscribeToGame,
        useItem,
        performShoot,
        endTurn,
        leaveGame
    };
});
