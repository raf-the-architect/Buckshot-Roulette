/**
 * Room Store
 * Manages game room/lobby state and Firebase synchronization
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
    onSnapshot, serverTimestamp, arrayUnion, writeBatch
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuthStore } from './authStore';
import { generateId } from '@/utils/nameGenerator';
import { ROOM_STATUS, MAX_PLAYERS } from '@/utils/constants';

export const useRoomStore = defineStore('room', () => {
    // =========================================================================
    // STATE
    // =========================================================================
    const currentRoom = ref(null);
    const roomPlayers = ref([]);
    const isLoading = ref(false);
    const error = ref(null);

    // Firebase listeners
    let unsubscribeRoom = null;
    let unsubscribePlayers = null;

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
            roomPlayers.value.length >= 2 &&
            roomPlayers.value.every(p => p.isReady);
    });

    const playerCount = computed(() => roomPlayers.value.length);

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

            const roomData = {
                roomId: roomCode,
                hostId: authStore.userId,
                status: ROOM_STATUS.WAITING,
                maxPlayers: settings.maxPlayers || 4,
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
                    isReady: false,
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
                isReady: false,
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
            console.error('Error creating room:', err);
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

            if (roomData.status !== ROOM_STATUS.WAITING) {
                if (roomData.status === ROOM_STATUS.PLAYING) {
                    // Could join as spectator - for now throw error
                    throw new Error('Game already in progress');
                }
                throw new Error('Game has ended');
            }

            if (roomData.currentPlayers >= roomData.maxPlayers) {
                throw new Error('Room is full');
            }

            // Check if already in room
            const playerRef = doc(db, 'rooms', normalizedCode, 'players', authStore.userId);
            const playerSnap = await getDoc(playerRef);

            if (playerSnap.exists()) {
                // Already in room, just subscribe
                await subscribeToRoom(normalizedCode);
                return 'player';
            }

            // Find available slot
            const existingSlots = roomData.playerList.map(p => p.slotIndex || 0);
            let slotIndex = 0;
            while (existingSlots.includes(slotIndex)) slotIndex++;

            const batch = writeBatch(db);

            // Update room's playerList
            const updatedPlayerList = [...roomData.playerList, {
                userId: authStore.userId,
                displayName: authStore.displayName,
                isHost: false,
                isReady: false,
                joinedAt: new Date().toISOString()
            }];

            batch.update(roomRef, {
                playerList: updatedPlayerList,
                playerIds: [...roomData.playerIds, authStore.userId],
                currentPlayers: roomData.currentPlayers + 1,
                updatedAt: serverTimestamp()
            });

            // Add to players subcollection
            batch.set(playerRef, {
                userId: authStore.userId,
                displayName: authStore.displayName,
                isHost: false,
                isReady: false,
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
            console.error('Error joining room:', err);
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
                console.error('Room subscription error:', err);
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
                console.error('Players subscription error:', err);
            }
        );
    };

    /**
     * Set player ready state
     * @param {boolean} isReady - Ready state
     */
    const setReady = async (isReady) => {
        const authStore = useAuthStore();
        const roomIdVal = currentRoom.value?.roomId;

        if (!roomIdVal) return;

        try {
            // Update player in subcollection
            await updateDoc(doc(db, 'rooms', roomIdVal, 'players', authStore.userId), {
                isReady
            });

            // Update playerList in room document
            const updatedList = currentRoom.value.playerList.map(p =>
                p.userId === authStore.userId ? { ...p, isReady } : p
            );

            await updateDoc(doc(db, 'rooms', roomIdVal), {
                playerList: updatedList,
                updatedAt: serverTimestamp()
            });
        } catch (err) {
            console.error('Error setting ready:', err);
            throw err;
        }
    };

    /**
     * Leave current room
     */
    const leaveRoom = async () => {
        const authStore = useAuthStore();
        const roomIdVal = currentRoom.value?.roomId;

        if (!roomIdVal) return;

        try {
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
            console.error('Error leaving room:', err);
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
            console.error('Error kicking player:', err);
            throw err;
        }
    };

    /**
     * Unsubscribe from room listeners
     */
    const unsubscribeFromRoom = () => {
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

        // Actions
        createRoom,
        joinRoom,
        subscribeToRoom,
        setReady,
        leaveRoom,
        kickPlayer,
        unsubscribeFromRoom
    };
});
