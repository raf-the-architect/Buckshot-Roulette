/**
 * Room Store
 * Manages game room/lobby state and Firebase synchronization
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
    onSnapshot, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuthStore } from './authStore';
import { generateId } from '@/utils/nameGenerator';
import { ROOM_STATUS, MAX_PLAYERS, MIN_PLAYERS } from '@/utils/constants';
import { createLogger } from '@/utils/logger';

const logger = createLogger('RoomStore');
const PRESENCE_HEARTBEAT_MS = 5000;
const PRESENCE_STALE_MS = 15000;

export const useRoomStore = defineStore('room', () => {
    // =========================================================================
    // STATE
    // =========================================================================
    const currentRoom = ref(null);
    const roomPlayers = ref([]);
    const isLoading = ref(false);
    const error = ref(null);
    const presenceNowTick = ref(Date.now());

    // Firebase listeners
    let unsubscribeRoom = null;
    let unsubscribePlayers = null;
    let presenceHeartbeatInterval = null;
    let presenceClockInterval = null;
    let visibilityChangeHandler = null;
    let pageHideHandler = null;

    // =========================================================================
    // GETTERS
    // =========================================================================
    const roomId = computed(() => currentRoom.value?.roomId);

    const isHost = computed(() => {
        const authStore = useAuthStore();
        return currentRoom.value?.hostId === authStore.userId;
    });

    const isInRoom = computed(() => !!currentRoom.value);

    const canStart = computed(() => {
        return isHost.value &&
            roomPlayers.value.length >= MIN_PLAYERS &&
            roomPlayers.value.length <= (currentRoom.value?.maxPlayers || MAX_PLAYERS);
    });

    const playerCount = computed(() => roomPlayers.value.length);

    /**
     * Convert Firestore timestamp-like values to milliseconds.
     * @param {any} value - Timestamp-like value.
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

    const playerPresenceById = computed(() => {
        const nowMs = presenceNowTick.value;
        return roomPlayers.value.reduce((acc, player) => {
            const userId = player.userId;
            if (!userId) return acc;

            const lastPingMs = timestampToMillis(player.lastPing);
            const status = String(player.status || 'active');
            const stale = !lastPingMs || (nowMs - lastPingMs) > PRESENCE_STALE_MS;
            const isConnected = !stale && status !== 'away' && status !== 'left' && status !== 'offline';

            acc[userId] = {
                isConnected,
                status,
                stale,
                lastPingMs
            };
            return acc;
        }, {});
    });

    const stopPresenceClock = () => {
        if (presenceClockInterval) {
            clearInterval(presenceClockInterval);
            presenceClockInterval = null;
        }
    };

    const startPresenceClock = () => {
        stopPresenceClock();
        presenceNowTick.value = Date.now();
        presenceClockInterval = setInterval(() => {
            presenceNowTick.value = Date.now();
        }, 1000);
    };

    const updateLocalPresence = async (status = 'active', roomIdOverride = null) => {
        const roomIdVal = roomIdOverride || currentRoom.value?.roomId;
        const authStore = useAuthStore();
        if (!roomIdVal || !authStore.userId) return;

        try {
            await updateDoc(doc(db, 'rooms', roomIdVal, 'players', authStore.userId), {
                status,
                lastPing: serverTimestamp()
            });
        } catch (err) {
            logger.debug('presence_update_failed', { status, error: err.message });
        }
    };

    const stopPresenceHeartbeat = () => {
        if (presenceHeartbeatInterval) {
            clearInterval(presenceHeartbeatInterval);
            presenceHeartbeatInterval = null;
        }

        if (visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', visibilityChangeHandler);
            visibilityChangeHandler = null;
        }

        if (pageHideHandler) {
            window.removeEventListener('pagehide', pageHideHandler);
            window.removeEventListener('beforeunload', pageHideHandler);
            pageHideHandler = null;
        }
    };

    const startPresenceHeartbeat = (roomIdVal) => {
        stopPresenceHeartbeat();

        const pingActive = () => {
            if (document.visibilityState !== 'visible') return;
            void updateLocalPresence('active', roomIdVal);
        };

        pingActive();
        presenceHeartbeatInterval = setInterval(pingActive, PRESENCE_HEARTBEAT_MS);

        visibilityChangeHandler = () => {
            if (document.visibilityState === 'visible') {
                void updateLocalPresence('active', roomIdVal);
                return;
            }
            void updateLocalPresence('away', roomIdVal);
        };
        document.addEventListener('visibilitychange', visibilityChangeHandler);

        pageHideHandler = () => {
            void updateLocalPresence('away', roomIdVal);
        };
        window.addEventListener('pagehide', pageHideHandler);
        window.addEventListener('beforeunload', pageHideHandler);
    };

    // =========================================================================
    // ACTIONS
    // =========================================================================

    /**
     * Create a new game room
     * @param {Object} settings - Room settings
     * @returns {Promise<string>} Room ID
     */
    const createRoom = async (settings = {}) => {
        isLoading.value = true;
        error.value = null;

        try {
            const authStore = useAuthStore();
            const roomCode = generateId(6);

            const configuredMaxPlayers = Number(settings.maxPlayers) || MAX_PLAYERS;
            const maxPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, configuredMaxPlayers));

            const roomData = {
                roomId: roomCode,
                hostId: authStore.userId,
                status: ROOM_STATUS.WAITING,
                maxPlayers,
                currentPlayers: 1,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                gameSettings: {
                    maxRounds: settings.maxRounds || null,
                    itemsEnabled: settings.itemsEnabled !== false,
                    turnTimeLimit: 30
                },
                inviteCode: roomCode,
                inviteLink: `${window.location.origin}/join/${roomCode}`,
                playerIds: [authStore.userId],
                playerList: [{
                    userId: authStore.userId,
                    displayName: authStore.displayName,
                    isHost: true,
                    slotIndex: 0,
                    joinedAt: new Date().toISOString()
                }]
            };

            // Create room document
            await setDoc(doc(db, 'rooms', roomCode), roomData);

            // Add host to players subcollection
            await setDoc(doc(db, 'rooms', roomCode, 'players', authStore.userId), {
                userId: authStore.userId,
                displayName: authStore.displayName,
                isHost: true,
                slotIndex: 0,
                joinedAt: serverTimestamp(),
                lastPing: serverTimestamp(),
                status: 'active'
            });

            currentRoom.value = roomData;
            await subscribeToRoom(roomCode);

            return roomCode;
        } catch (err) {
            error.value = err.message;
            logger.error('create_room_failed', { error: err.message });
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Join an existing room
     * @param {string} roomCode - Room invite code
     * @returns {Promise<string>} 'player' or 'spectator'
     */
    const joinRoom = async (roomCode) => {
        isLoading.value = true;
        error.value = null;

        try {
            const authStore = useAuthStore();
            const normalizedCode = roomCode.toUpperCase().trim();
            const roomRef = doc(db, 'rooms', normalizedCode);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) {
                throw new Error('Room not found');
            }

            const roomData = roomSnap.data();
            const playerRef = doc(db, 'rooms', normalizedCode, 'players', authStore.userId);
            const playerSnap = await getDoc(playerRef);
            const roomPlayerList = Array.isArray(roomData.playerList) ? roomData.playerList : [];
            const roomPlayerIds = Array.isArray(roomData.playerIds) ? roomData.playerIds : [];
            const existingEntry = roomPlayerList.find(p => p.userId === authStore.userId) || null;
            const isExistingPlayer =
                playerSnap.exists() ||
                !!existingEntry ||
                roomPlayerIds.includes(authStore.userId);

            // Allow reconnect/rejoin for existing room members even while game is already
            // playing or between matches after it ended.
            if (isExistingPlayer) {
                const updatedPlayerList = [...roomPlayerList];
                const isHostPlayer = roomData.hostId === authStore.userId;

                let slotIndex = Number(existingEntry?.slotIndex);
                if (!Number.isFinite(slotIndex) || slotIndex < 0) {
                    const occupiedSlots = updatedPlayerList
                        .filter(p => p.userId !== authStore.userId)
                        .map(p => Number(p.slotIndex))
                        .filter(n => Number.isFinite(n) && n >= 0);
                    slotIndex = 0;
                    while (occupiedSlots.includes(slotIndex)) slotIndex++;
                }

                const joinedAt = existingEntry?.joinedAt || new Date().toISOString();
                const nextEntry = {
                    userId: authStore.userId,
                    displayName: authStore.displayName,
                    isHost: isHostPlayer,
                    slotIndex,
                    joinedAt
                };

                if (existingEntry) {
                    const index = updatedPlayerList.findIndex(p => p.userId === authStore.userId);
                    updatedPlayerList[index] = {
                        ...updatedPlayerList[index],
                        ...nextEntry
                    };
                } else {
                    updatedPlayerList.push(nextEntry);
                }

                const mergedPlayerIds = roomPlayerIds.includes(authStore.userId)
                    ? roomPlayerIds
                    : [...roomPlayerIds, authStore.userId];

                const batch = writeBatch(db);
                batch.set(playerRef, {
                    userId: authStore.userId,
                    displayName: authStore.displayName,
                    isHost: isHostPlayer,
                    slotIndex,
                    joinedAt: playerSnap.data()?.joinedAt || serverTimestamp(),
                    lastPing: serverTimestamp(),
                    status: 'active'
                }, { merge: true });

                const roomPatch = {
                    playerList: updatedPlayerList,
                    updatedAt: serverTimestamp()
                };

                if (!roomPlayerIds.includes(authStore.userId) || !existingEntry) {
                    roomPatch.playerIds = mergedPlayerIds;
                    roomPatch.currentPlayers = Math.max(
                        Number(roomData.currentPlayers) || 0,
                        updatedPlayerList.length
                    );
                }

                batch.update(roomRef, roomPatch);
                await batch.commit();
                await subscribeToRoom(normalizedCode);
                return 'player';
            }

            if (roomData.status !== ROOM_STATUS.WAITING) {
                if (roomData.status === ROOM_STATUS.PLAYING) {
                    throw new Error('Game already in progress');
                }
                throw new Error('Game has ended');
            }

            if (roomData.currentPlayers >= roomData.maxPlayers) {
                throw new Error('Room is full');
            }

            // Find available slot
            const existingSlots = roomPlayerList.map(p => p.slotIndex || 0);
            let slotIndex = 0;
            while (existingSlots.includes(slotIndex)) slotIndex++;

            const batch = writeBatch(db);

            // Update room's playerList
            const updatedPlayerList = [...roomPlayerList, {
                userId: authStore.userId,
                displayName: authStore.displayName,
                isHost: false,
                slotIndex,
                joinedAt: new Date().toISOString()
            }];

            batch.update(roomRef, {
                playerList: updatedPlayerList,
                playerIds: [...roomPlayerIds, authStore.userId],
                currentPlayers: roomData.currentPlayers + 1,
                updatedAt: serverTimestamp()
            });

            // Add to players subcollection
            batch.set(playerRef, {
                userId: authStore.userId,
                displayName: authStore.displayName,
                isHost: false,
                slotIndex,
                joinedAt: serverTimestamp(),
                lastPing: serverTimestamp(),
                status: 'active'
            });

            await batch.commit();
            await subscribeToRoom(normalizedCode);

            return 'player';
        } catch (err) {
            error.value = err.message;
            logger.error('join_room_failed', { roomCode, error: err.message });
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Subscribe to room and players updates
     * @param {string} roomId - Room ID
     */
    const subscribeToRoom = async (roomId) => {
        // Unsubscribe from previous room
        unsubscribeFromRoom();

        // Subscribe to room document
        unsubscribeRoom = onSnapshot(
            doc(db, 'rooms', roomId),
            (docSnap) => {
                if (docSnap.exists()) {
                    currentRoom.value = { id: docSnap.id, ...docSnap.data() };
                } else {
                    currentRoom.value = null;
                }
            },
            (err) => {
                error.value = err.message;
                logger.error('room_subscription_error', { roomId, error: err.message });
            }
        );

        // Subscribe to players subcollection
        unsubscribePlayers = onSnapshot(
            collection(db, 'rooms', roomId, 'players'),
            (snapshot) => {
                roomPlayers.value = snapshot.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));
            },
            (err) => {
                logger.error('players_subscription_error', { roomId, error: err.message });
            }
        );

        startPresenceClock();
        startPresenceHeartbeat(roomId);
    };

    /**
     * Leave current room
     */
    const leaveRoom = async () => {
        const authStore = useAuthStore();
        const roomIdVal = currentRoom.value?.roomId;

        if (!roomIdVal) return;

        try {
            stopPresenceHeartbeat();
            stopPresenceClock();
            // Unsubscribe first
            unsubscribeFromRoom();

            // Remove from players subcollection
            await deleteDoc(doc(db, 'rooms', roomIdVal, 'players', authStore.userId));

            // Update room
            const updatedList = currentRoom.value.playerList.filter(
                p => p.userId !== authStore.userId
            );

            if (isHost.value) {
                if (updatedList.length > 0) {
                    // Transfer host to next player
                    const newHost = updatedList[0];
                    updatedList[0] = { ...newHost, isHost: true };

                    await updateDoc(doc(db, 'rooms', roomIdVal), {
                        hostId: newHost.userId,
                        playerList: updatedList,
                        currentPlayers: updatedList.length,
                        updatedAt: serverTimestamp()
                    });

                    await updateDoc(doc(db, 'rooms', roomIdVal, 'players', newHost.userId), {
                        isHost: true
                    });
                } else {
                    // Delete empty room
                    await deleteDoc(doc(db, 'rooms', roomIdVal));
                }
            } else {
                await updateDoc(doc(db, 'rooms', roomIdVal), {
                    playerList: updatedList,
                    playerIds: updatedList.map(p => p.userId),
                    currentPlayers: updatedList.length,
                    updatedAt: serverTimestamp()
                });
            }

            currentRoom.value = null;
            roomPlayers.value = [];
        } catch (err) {
            logger.error('leave_room_failed', { roomId: roomIdVal, error: err.message });
            throw err;
        }
    };

    /**
     * Kick a player from room (host only)
     * @param {string} playerId - Player to kick
     */
    const kickPlayer = async (playerId) => {
        if (!isHost.value) return;

        const roomIdVal = currentRoom.value?.roomId;

        try {
            await deleteDoc(doc(db, 'rooms', roomIdVal, 'players', playerId));

            const updatedList = currentRoom.value.playerList.filter(
                p => p.userId !== playerId
            );

            await updateDoc(doc(db, 'rooms', roomIdVal), {
                playerList: updatedList,
                playerIds: updatedList.map(p => p.userId),
                currentPlayers: updatedList.length,
                updatedAt: serverTimestamp()
            });
        } catch (err) {
            logger.error('kick_player_failed', { playerId, error: err.message });
            throw err;
        }
    };

    /**
     * Unsubscribe from room listeners
     */
    const unsubscribeFromRoom = () => {
        stopPresenceHeartbeat();
        stopPresenceClock();
        if (unsubscribeRoom) {
            unsubscribeRoom();
            unsubscribeRoom = null;
        }
        if (unsubscribePlayers) {
            unsubscribePlayers();
            unsubscribePlayers = null;
        }
    };

    return {
        // State
        currentRoom,
        roomPlayers,
        isLoading,
        error,

        // Getters
        roomId,
        isHost,
        isInRoom,
        canStart,
        playerCount,
        playerPresenceById,

        // Actions
        createRoom,
        joinRoom,
        subscribeToRoom,
        leaveRoom,
        kickPlayer,
        unsubscribeFromRoom
    };
});
