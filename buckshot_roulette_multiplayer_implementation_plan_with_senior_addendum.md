# Buckshot Roulette - Multiplayer Implementation Plan
## Transforming Single-Player to Online Multiplayer with Firebase

---

## Executive Summary

This document provides a complete, actionable implementation plan to transform the single-player Buckshot Roulette game into a 1-8 player online multiplayer experience using Firebase (Firestore + Realtime Database + Authentication). The plan is designed as direct input for an AI agent implementation.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Vue.js    │  │   Phaser    │  │   Pinia     │  │   Firebase SDK      │ │
│  │    UI       │  │   Game      │  │   Store     │  │   (Auth/DB)         │ │
│  │  (Lobby,    │  │  (Renderer, │  │  (State     │  │                     │ │
│  │   HUD,      │  │   Animation)│  │   Mgmt)     │  │                     │ │
│  │   Menus)    │  │             │  │             │  │                     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         └─────────────────┴─────────────────┘                    │            │
│                           │                                      │            │
│                    Game State Synchronization                    │            │
│                           │                                      │            │
└───────────────────────────┼──────────────────────────────────────┼────────────┘
                            │                                      │
                            ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FIREBASE BACKEND                                │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │  Firebase Auth      │  │  Cloud Firestore    │  │  Cloud Functions    │  │
│  │  (Anonymous)        │  │  (Game State,       │  │  (Matchmaking,      │  │
│  │                     │  │   Rooms, Players)   │  │   Cleanup, AFK)     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack Confirmation

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend Framework | Vue.js 3 (Composition API) | UI, routing, component architecture |
| Game Engine | Phaser 3 | Game rendering, animations, input handling |
| State Management | Pinia | Client-side state, reactive game data |
| Backend | Firebase | Authentication, database, serverless functions |
| Database | Cloud Firestore | Persistent game state, rooms, player data |
| Real-time | Firestore Realtime Listeners | Live state synchronization |
| Hosting | Firebase Hosting | Web deployment |

---

## Phase 1: Firebase Project Setup

### 1.1 Create Firebase Project

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project root
firebase init

# Select services:
# - Firestore
# - Functions
# - Hosting
# - Emulators (for local development)
```

### 1.2 Firebase Configuration File

**File: `src/config/firebase.js`**

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
  authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
```

### 1.3 Environment Variables

**File: `.env`**

```
VUE_APP_FIREBASE_API_KEY=your_api_key
VUE_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VUE_APP_FIREBASE_PROJECT_ID=your_project_id
VUE_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VUE_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VUE_APP_FIREBASE_APP_ID=your_app_id
```

---

## Phase 2: Database Schema Design

### 2.1 Firestore Collections Structure

```
firestore/
├── users/{userId}                    # Anonymous player profiles
├── rooms/{roomId}                    # Game lobbies/rooms
│   ├── players/{playerId}            # Players in room
│   └── spectators/{spectatorId}      # Spectators watching
├── games/{gameId}                    # Active game sessions
│   ├── rounds/{roundNumber}          # Round history
│   └── actions/{actionId}            # Action log
└── leaderboards/{leaderboardId}      # Optional: stats
```

### 2.2 Detailed Schema

#### Collection: `users`

```javascript
{
  userId: string,           // Auto-generated by Firebase Auth
  displayName: string,      // Random name (e.g., "Player#A7B2")
  avatar: string,           // Avatar URL or identifier
  createdAt: timestamp,
  lastActive: timestamp,
  stats: {
    gamesPlayed: number,
    gamesWon: number,
    totalKills: number,
    favoriteItem: string
  }
}
```

#### Collection: `rooms`

```javascript
{
  roomId: string,           // 6-character alphanumeric code (e.g., "X7K9P2")
  hostId: string,           // User ID of room creator
  status: string,           // 'waiting' | 'starting' | 'playing' | 'ended'
  maxPlayers: number,       // 2-8 (default: 4)
  currentPlayers: number,
  createdAt: timestamp,
  updatedAt: timestamp,
  gameSettings: {
    maxRounds: number,      // Optional: round limit
    itemsEnabled: boolean,
    turnTimeLimit: number   // 30 seconds
  },
  inviteCode: string,       // Shareable code
  inviteLink: string,       // Full URL
  
  // Denormalized for quick reads
  playerList: [
    {
      userId: string,
      displayName: string,
      isHost: boolean,
      isReady: boolean,
      joinedAt: timestamp
    }
  ]
}
```

#### Subcollection: `rooms/{roomId}/players`

```javascript
{
  userId: string,
  displayName: string,
  isHost: boolean,
  isReady: boolean,
  slotIndex: number,        // 0-7 position at table
  joinedAt: timestamp,
  lastPing: timestamp,      // For AFK detection
  status: string            // 'active' | 'disconnected' | 'kicked'
}
```

#### Collection: `games`

```javascript
{
  gameId: string,           // Same as roomId for simplicity
  roomId: string,
  status: string,           // 'active' | 'paused' | 'ended'
  createdAt: timestamp,
  startedAt: timestamp,
  endedAt: timestamp,
  
  // Game Configuration
  config: {
    maxPlayers: number,
    itemsEnabled: boolean,
    turnTimeLimit: number
  },
  
  // Current State
  currentRound: number,
  currentTurn: number,      // Index of current player
  turnStartedAt: timestamp, // For turn timer
  phase: string,            // 'setup' | 'item' | 'aim' | 'shoot' | 'resolution' | 'round_end'
  
  // Shotgun State
  shotgun: {
    chamber: Array<string>, // 'live' | 'blank' | 'unknown' (for spectators)
    liveRounds: number,
    blankRounds: number,
    totalRounds: number,
    isSawedOff: boolean
  },
  
  // Players Array (ordered by turn)
  players: [
    {
      userId: string,
      displayName: string,
      slotIndex: number,
      health: number,       // 1-6 (max varies by player count)
      maxHealth: number,
      items: Array<string>, // Current items
      isAlive: boolean,
      isConnected: boolean,
      lastActionAt: timestamp
    }
  ],
  
  // Current Turn Context
  turnContext: {
    playerId: string,
    phase: string,
    timeRemaining: number,
    selectedItem: string | null,
    targetPlayerId: string | null,
    hasShot: boolean
  },
  
  // Game Log (last 50 actions for display)
  recentActions: [
    {
      actionId: string,
      type: string,         // 'shoot' | 'item_use' | 'reload' | 'player_died' | 'round_start'
      playerId: string,
      targetId: string | null,
      result: object,       // Action-specific result data
      timestamp: timestamp
    }
  ],
  
  // Winner
  winner: {
    userId: string,
    displayName: string
  } | null
}
```

#### Subcollection: `games/{gameId}/actions`

```javascript
{
  actionId: string,
  type: string,             // 'shoot' | 'use_item' | 'reload' | 'pass'
  roundNumber: number,
  turnNumber: number,
  playerId: string,
  targetId: string | null,
  itemUsed: string | null,
  
  // Pre-action state snapshot
  stateBefore: {
    shotgun: object,
    playerHealth: object
  },
  
  // Action result
  result: {
    success: boolean,
    damage: number,
    roundType: string,      // 'live' | 'blank' | null
    chamberPosition: number,
    killed: Array<string>   // Player IDs killed by this action
  },
  
  timestamp: timestamp
}
```

### 2.3 Firestore Security Rules

**File: `firestore.rules`**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isRoomHost(roomId) {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/rooms/$(roomId)).data.hostId == request.auth.uid;
    }
    
    function isRoomPlayer(roomId) {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/rooms/$(roomId)/players/$(request.auth.uid));
    }
    
    function isGamePlayer(gameId) {
      return isAuthenticated() && 
        request.auth.uid in get(/databases/$(database)/documents/games/$(gameId)).data.players.map(p => p.userId);
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false;
    }
    
    // Rooms collection
    match /rooms/{roomId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isRoomHost(roomId) || 
        (isRoomPlayer(roomId) && 
         request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['playerList', 'currentPlayers']));
      allow delete: if isRoomHost(roomId);
      
      // Room players subcollection
      match /players/{playerId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && 
          (playerId == request.auth.uid || isRoomHost(roomId));
        allow update: if isOwner(playerId) || isRoomHost(roomId);
        allow delete: if isOwner(playerId) || isRoomHost(roomId);
      }
      
      // Spectators subcollection
      match /spectators/{spectatorId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated();
        allow delete: if isOwner(spectatorId);
      }
    }
    
    // Games collection
    match /games/{gameId} {
      allow read: if isAuthenticated();
      allow create: if isRoomHost(gameId);
      allow update: if isGamePlayer(gameId) || isRoomHost(gameId);
      allow delete: if false;
      
      // Actions subcollection (append-only)
      match /actions/{actionId} {
        allow read: if isGamePlayer(gameId);
        allow create: if isGamePlayer(gameId);
        allow update: if false;
        allow delete: if false;
      }
      
      // Rounds subcollection
      match /rounds/{roundNumber} {
        allow read: if isGamePlayer(gameId);
        allow write: if isRoomHost(gameId);
      }
    }
  }
}
```

---

## Phase 3: Client Architecture

### 3.1 Project Structure

```
src/
├── assets/                 # Static assets (images, sounds)
├── components/
│   ├── ui/                 # Vue UI components
│   │   ├── LobbyView.vue
│   │   ├── RoomList.vue
│   │   ├── PlayerCard.vue
│   │   ├── GameHUD.vue
│   │   ├── TurnTimer.vue
│   │   ├── ItemSelector.vue
│   │   ├── TargetSelector.vue
│   │   ├── GameLog.vue
│   │   └── SpectatorOverlay.vue
│   └── game/               # Phaser game components
│       ├── GameScene.js
│       ├── Shotgun.js
│       ├── PlayerAvatar.js
│       └── Effects.js
├── composables/            # Vue 3 composables
│   ├── useAuth.js
│   ├── useRoom.js
│   ├── useGame.js
│   ├── useTurnTimer.js
│   └── useSpectator.js
├── stores/                 # Pinia stores
│   ├── authStore.js
│   ├── roomStore.js
│   ├── gameStore.js
│   └── uiStore.js
├── services/               # Firebase services
│   ├── authService.js
│   ├── roomService.js
│   ├── gameService.js
│   └── firebaseListeners.js
├── utils/
│   ├── constants.js
│   ├── helpers.js
│   └── nameGenerator.js
├── router/
│   └── index.js
├── App.vue
└── main.js
```

### 3.2 Pinia Store Architecture

#### Store: `authStore.js`

```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { generateRandomName } from '@/utils/nameGenerator';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null);
  const userProfile = ref(null);
  const isLoading = ref(false);
  const error = ref(null);
  
  // Getters
  const isAuthenticated = computed(() => !!user.value);
  const userId = computed(() => user.value?.uid);
  const displayName = computed(() => userProfile.value?.displayName || 'Guest');
  
  // Actions
  const initAuth = () => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          user.value = firebaseUser;
          await loadUserProfile(firebaseUser.uid);
        }
        resolve(firebaseUser);
      });
    });
  };
  
  const signInAnonymous = async () => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const result = await signInAnonymously(auth);
      user.value = result.user;
      
      // Generate random display name
      const randomName = generateRandomName();
      
      // Update Firebase Auth profile
      await updateProfile(result.user, { displayName: randomName });
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        userId: result.user.uid,
        displayName: randomName,
        avatar: `avatar_${Math.floor(Math.random() * 8) + 1}`,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalKills: 0,
          favoriteItem: null
        }
      });
      
      userProfile.value = {
        userId: result.user.uid,
        displayName: randomName,
        avatar: `avatar_${Math.floor(Math.random() * 8) + 1}`
      };
      
      return result.user;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };
  
  const loadUserProfile = async (uid) => {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      userProfile.value = docSnap.data();
    }
  };
  
  const updateLastActive = async () => {
    if (user.value) {
      await updateDoc(doc(db, 'users', user.value.uid), {
        lastActive: serverTimestamp()
      });
    }
  };
  
  return {
    user,
    userProfile,
    isLoading,
    error,
    isAuthenticated,
    userId,
    displayName,
    initAuth,
    signInAnonymous,
    loadUserProfile,
    updateLastActive
  };
});
```

#### Store: `roomStore.js`

```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
  arrayUnion, arrayRemove, writeBatch
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuthStore } from './authStore';

export const useRoomStore = defineStore('room', () => {
  // State
  const currentRoom = ref(null);
  const roomPlayers = ref([]);
  const spectators = ref([]);
  const availableRooms = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const unsubscribeRoom = ref(null);
  const unsubscribePlayers = ref(null);
  
  // Getters
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
  
  // Actions
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };
  
  const createRoom = async (settings = {}) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const authStore = useAuthStore();
      const roomCode = generateRoomCode();
      const roomId = roomCode; // Use code as ID for simplicity
      
      const roomData = {
        roomId,
        hostId: authStore.userId,
        status: 'waiting',
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
        playerList: [{
          userId: authStore.userId,
          displayName: authStore.displayName,
          isHost: true,
          isReady: false,
          joinedAt: serverTimestamp()
        }]
      };
      
      await setDoc(doc(db, 'rooms', roomId), roomData);
      
      // Add host to players subcollection
      await setDoc(doc(db, 'rooms', roomId, 'players', authStore.userId), {
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
      await subscribeToRoom(roomId);
      
      return roomId;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };
  
  const joinRoom = async (roomCode) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const authStore = useAuthStore();
      const roomRef = doc(db, 'rooms', roomCode.toUpperCase());
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        throw new Error('Room not found');
      }
      
      const roomData = roomSnap.data();
      
      if (roomData.status !== 'waiting') {
        // Allow joining as spectator if game is active
        if (roomData.status === 'playing') {
          await joinAsSpectator(roomCode);
          return 'spectator';
        }
        throw new Error('Game has already ended');
      }
      
      if (roomData.currentPlayers >= roomData.maxPlayers) {
        throw new Error('Room is full');
      }
      
      // Check if already in room
      const playerRef = doc(db, 'rooms', roomCode, 'players', authStore.userId);
      const playerSnap = await getDoc(playerRef);
      
      if (playerSnap.exists()) {
        await subscribeToRoom(roomCode);
        return 'player';
      }
      
      // Find available slot
      const existingSlots = roomData.playerList.map(p => p.slotIndex);
      let slotIndex = 0;
      while (existingSlots.includes(slotIndex)) slotIndex++;
      
      const batch = writeBatch(db);
      
      // Add to room's playerList
      batch.update(roomRef, {
        playerList: arrayUnion({
          userId: authStore.userId,
          displayName: authStore.displayName,
          isHost: false,
          isReady: false,
          joinedAt: serverTimestamp()
        }),
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
      await subscribeToRoom(roomCode);
      
      return 'player';
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };
  
  const joinAsSpectator = async (roomCode) => {
    const authStore = useAuthStore();
    await setDoc(doc(db, 'rooms', roomCode, 'spectators', authStore.userId), {
      userId: authStore.userId,
      displayName: authStore.displayName,
      joinedAt: serverTimestamp()
    });
  };
  
  const subscribeToRoom = (roomId) => {
    // Unsubscribe from previous
    unsubscribeRoom.value?.();
    unsubscribePlayers.value?.();
    
    // Subscribe to room document
    unsubscribeRoom.value = onSnapshot(
      doc(db, 'rooms', roomId),
      (doc) => {
        if (doc.exists()) {
          currentRoom.value = { id: doc.id, ...doc.data() };
        } else {
          currentRoom.value = null;
        }
      },
      (err) => {
        error.value = err.message;
      }
    );
    
    // Subscribe to players subcollection
    unsubscribePlayers.value = onSnapshot(
      collection(db, 'rooms', roomId, 'players'),
      (snapshot) => {
        roomPlayers.value = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.slotIndex - b.slotIndex);
      }
    );
  };
  
  const setReady = async (isReady) => {
    const authStore = useAuthStore();
    const roomId = currentRoom.value?.roomId;
    
    await updateDoc(doc(db, 'rooms', roomId, 'players', authStore.userId), {
      isReady
    });
    
    // Update playerList in room document
    const updatedList = currentRoom.value.playerList.map(p => 
      p.userId === authStore.userId ? { ...p, isReady } : p
    );
    
    await updateDoc(doc(db, 'rooms', roomId), {
      playerList: updatedList,
      updatedAt: serverTimestamp()
    });
  };
  
  const leaveRoom = async () => {
    const authStore = useAuthStore();
    const roomId = currentRoom.value?.roomId;
    
    if (!roomId) return;
    
    // Unsubscribe first
    unsubscribeRoom.value?.();
    unsubscribePlayers.value?.();
    
    // Remove from players
    await deleteDoc(doc(db, 'rooms', roomId, 'players', authStore.userId));
    
    // Update room
    const updatedList = currentRoom.value.playerList.filter(
      p => p.userId !== authStore.userId
    );
    
    if (isHost.value) {
      if (updatedList.length > 0) {
        // Transfer host to next player
        const newHost = updatedList[0];
        await updateDoc(doc(db, 'rooms', roomId), {
          hostId: newHost.userId,
          playerList: updatedList,
          currentPlayers: updatedList.length,
          updatedAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'rooms', roomId, 'players', newHost.userId), {
          isHost: true
        });
      } else {
        // Delete empty room
        await deleteDoc(doc(db, 'rooms', roomId));
      }
    } else {
      await updateDoc(doc(db, 'rooms', roomId), {
        playerList: updatedList,
        currentPlayers: updatedList.length,
        updatedAt: serverTimestamp()
      });
    }
    
    currentRoom.value = null;
    roomPlayers.value = [];
  };
  
  const kickPlayer = async (playerId) => {
    if (!isHost.value) return;
    
    const roomId = currentRoom.value?.roomId;
    await deleteDoc(doc(db, 'rooms', roomId, 'players', playerId));
    
    const updatedList = currentRoom.value.playerList.filter(
      p => p.userId !== playerId
    );
    
    await updateDoc(doc(db, 'rooms', roomId), {
      playerList: updatedList,
      currentPlayers: updatedList.length,
      updatedAt: serverTimestamp()
    });
  };
  
  return {
    currentRoom,
    roomPlayers,
    spectators,
    availableRooms,
    isLoading,
    error,
    roomId,
    isHost,
    isInRoom,
    canStart,
    playerCount,
    createRoom,
    joinRoom,
    joinAsSpectator,
    setReady,
    leaveRoom,
    kickPlayer
  };
});
```

#### Store: `gameStore.js`

```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  doc, setDoc, updateDoc, getDoc, onSnapshot, collection,
  addDoc, serverTimestamp, writeBatch, query, orderBy, limit
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuthStore } from './authStore';
import { useRoomStore } from './roomStore';

// Game constants
const ITEMS = {
  HANDCUFFS: 'handcuffs',
  CIGARETTE: 'cigarette',
  BEER: 'beer',
  MAGNIFYING_GLASS: 'magnifying_glass',
  HAND_SAW: 'hand_saw',
  EXPIRED_MEDICINE: 'expired_medicine',
  INVERTER: 'inverter',
  BURNER_PHONE: 'burner_phone',
  ADRENALINE: 'adrenaline'
};

export const useGameStore = defineStore('game', () => {
  // State
  const currentGame = ref(null);
  const gameActions = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const unsubscribeGame = ref(null);
  const unsubscribeActions = ref(null);
  
  // Local turn timer state
  const turnTimeRemaining = ref(30);
  const turnTimerInterval = ref(null);
  
  // Getters
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
  
  // Actions
  const startGame = async () => {
    const roomStore = useRoomStore();
    const authStore = useAuthStore();
    
    if (!roomStore.isHost) {
      throw new Error('Only host can start game');
    }
    
    isLoading.value = true;
    
    try {
      const roomId = roomStore.roomId;
      const players = roomStore.roomPlayers.map((p, index) => ({
        userId: p.userId,
        displayName: p.displayName,
        slotIndex: p.slotIndex,
        health: calculateInitialHealth(roomStore.roomPlayers.length),
        maxHealth: calculateInitialHealth(roomStore.roomPlayers.length),
        items: [],
        isAlive: true,
        isConnected: true,
        lastActionAt: serverTimestamp()
      }));
      
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
          turnTimeLimit: 30
        },
        currentRound: 1,
        currentTurn: 0,
        turnStartedAt: serverTimestamp(),
        phase: 'setup',
        shotgun: generateShotgun(2, 4), // Initial: 2 live, 4 blank
        players,
        turnContext: {
          playerId: players[0].userId,
          phase: 'item',
          timeRemaining: 30,
          selectedItem: null,
          targetPlayerId: null,
          hasShot: false
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
      
      // Start turn timer
      startTurnTimer();
      
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };
  
  const subscribeToGame = (gameId) => {
    unsubscribeGame.value?.();
    unsubscribeActions.value?.();
    
    unsubscribeGame.value = onSnapshot(
      doc(db, 'games', gameId),
      (doc) => {
        if (doc.exists()) {
          const prevGame = currentGame.value;
          currentGame.value = { id: doc.id, ...doc.data() };
          
          // Detect turn change and restart timer
          if (prevGame?.currentTurn !== currentGame.value.currentTurn) {
            startTurnTimer();
          }
        }
      },
      (err) => {
        error.value = err.message;
      }
    );
    
    // Subscribe to recent actions
    const actionsQuery = query(
      collection(db, 'games', gameId, 'actions'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    unsubscribeActions.value = onSnapshot(actionsQuery, (snapshot) => {
      gameActions.value = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse();
    });
  };
  
  const startTurnTimer = () => {
    clearInterval(turnTimerInterval.value);
    turnTimeRemaining.value = 30;
    
    turnTimerInterval.value = setInterval(() => {
      turnTimeRemaining.value--;
      
      if (turnTimeRemaining.value <= 0) {
        handleTurnTimeout();
      }
    }, 1000);
  };
  
  const handleTurnTimeout = async () => {
    clearInterval(turnTimerInterval.value);
    
    if (!isMyTurn.value) return;
    
    // Auto-skip: use blank if available, otherwise shoot self
    const blankIndex = currentGame.value.shotgun.chamber.findIndex(r => r === 'blank');
    
    if (blankIndex !== -1 && !currentGame.value.turnContext.hasShot) {
      // Shoot self with blank (safest auto-action)
      await performShoot(myPlayer.value.userId);
    } else {
      // Pass turn
      await endTurn();
    }
  };
  
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
    const updatedItems = player.items.filter(i => i !== itemType);
    const updatedPlayers = currentGame.value.players.map(p =>
      p.userId === authStore.userId ? { ...p, items: updatedItems } : p
    );
    
    // Process item effect
    let updateData = { players: updatedPlayers };
    
    switch (itemType) {
      case ITEMS.HANDCUFFS:
        // Skip target's next turn
        updateData.turnContext = {
          ...currentGame.value.turnContext,
          skipNextTurn: targetPlayerId
        };
        break;
        
      case ITEMS.CIGARETTE:
        // Restore 1 health
        const healedPlayers = updatedPlayers.map(p =>
          p.userId === authStore.userId && p.health < p.maxHealth
            ? { ...p, health: p.health + 1 }
            : p
        );
        updateData.players = healedPlayers;
        break;
        
      case ITEMS.BEER:
        // Eject current round
        const newChamber = [...currentGame.value.shotgun.chamber];
        const ejected = newChamber.shift();
        updateData.shotgun = {
          ...currentGame.value.shotgun,
          chamber: newChamber,
          [ejected === 'live' ? 'liveRounds' : 'blankRounds']: 
            currentGame.value.shotgun[ejected === 'live' ? 'liveRounds' : 'blankRounds'] - 1
        };
        break;
        
      case ITEMS.MAGNIFYING_GLASS:
        // Reveal current round (client-side only, stored in turnContext)
        updateData.turnContext = {
          ...currentGame.value.turnContext,
          revealedRound: currentGame.value.shotgun.chamber[0]
        };
        break;
        
      case ITEMS.HAND_SAW:
        // Double damage for next shot
        updateData.shotgun = {
          ...currentGame.value.shotgun,
          isSawedOff: true
        };
        break;
        
      case ITEMS.INVERTER:
        // Invert current round
        const invertedChamber = [...currentGame.value.shotgun.chamber];
        invertedChamber[0] = invertedChamber[0] === 'live' ? 'blank' : 'live';
        updateData.shotgun = {
          ...currentGame.value.shotgun,
          chamber: invertedChamber
        };
        break;
        
      case ITEMS.BURNER_PHONE:
        // Reveal random future round position
        const futureIndex = Math.floor(Math.random() * currentGame.value.shotgun.chamber.length);
        updateData.turnContext = {
          ...currentGame.value.turnContext,
          revealedPosition: {
            index: futureIndex,
            type: currentGame.value.shotgun.chamber[futureIndex]
          }
        };
        break;
        
      case ITEMS.ADRENALINE:
        // Steal item from target (handled separately, requires target selection)
        if (!targetPlayerId) throw new Error('Target required');
        // Implementation: show target's items, let player pick one
        break;
    }
    
    await updateDoc(gameRef, updateData);
    
    // Log action
    await addDoc(collection(db, 'games', gameId.value, 'actions'), {
      type: 'item_use',
      roundNumber: currentGame.value.currentRound,
      turnNumber: currentGame.value.currentTurn,
      playerId: authStore.userId,
      targetId: targetPlayerId,
      itemUsed: itemType,
      timestamp: serverTimestamp()
    });
  };
  
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
    
    // Check for round end (shotgun empty or all but one dead)
    const alivePlayers = updatedPlayers.filter(p => p.isAlive);
    const roundEnded = newChamber.length === 0 || alivePlayers.length === 1;
    
    let updateData = {
      shotgun: {
        ...shotgun,
        chamber: newChamber,
        [roundType === 'live' ? 'liveRounds' : 'blankRounds']: 
          shotgun[roundType === 'live' ? 'liveRounds' : 'blankRounds'] - 1,
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
      } else {
        // Start new round
        const newRound = currentGame.value.currentRound + 1;
        const liveCount = Math.min(newRound + 1, 4); // Progressive difficulty
        const blankCount = Math.min(newRound + 2, 5);
        
        updateData.currentRound = newRound;
        updateData.shotgun = generateShotgun(liveCount, blankCount);
        
        // Distribute items
        updatedPlayers = distributeItems(updatedPlayers, newRound);
        updateData.players = updatedPlayers;
      }
    }
    
    await updateDoc(gameRef, updateData);
    
    // Log action
    await addDoc(collection(db, 'games', gameId.value, 'actions'), {
      type: 'shoot',
      roundNumber: currentGame.value.currentRound,
      turnNumber: currentGame.value.currentTurn,
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
    
    // End turn (unless extra turn)
    if (!extraTurn && !roundEnded) {
      await endTurn();
    }
  };
  
  const endTurn = async () => {
    const gameRef = doc(db, 'games', gameId.value);
    const alivePlayers = currentGame.value.players.filter(p => p.isAlive);
    
    // Find next alive player
    let nextTurn = currentGame.value.currentTurn;
    do {
      nextTurn = (nextTurn + 1) % currentGame.value.players.length;
    } while (!currentGame.value.players[nextTurn].isAlive);
    
    // Check for handcuffs skip
    const nextPlayerId = currentGame.value.players[nextTurn].userId;
    if (currentGame.value.turnContext.skipNextTurn === nextPlayerId) {
      do {
        nextTurn = (nextTurn + 1) % currentGame.value.players.length;
      } while (!currentGame.value.players[nextTurn].isAlive);
    }
    
    await updateDoc(gameRef, {
      currentTurn: nextTurn,
      turnStartedAt: serverTimestamp(),
      phase: 'item',
      turnContext: {
        playerId: currentGame.value.players[nextTurn].userId,
        phase: 'item',
        timeRemaining: 30,
        selectedItem: null,
        targetPlayerId: null,
        hasShot: false,
        skipNextTurn: null,
        revealedRound: null,
        revealedPosition: null
      }
    });
  };
  
  // Helper functions
  const calculateInitialHealth = (playerCount) => {
    // More players = less health each for faster games
    if (playerCount <= 2) return 6;
    if (playerCount <= 4) return 4;
    return 3;
  };
  
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
  
  const distributeItems = (players, roundNumber) => {
    const itemPool = Object.values(ITEMS);
    const itemsPerPlayer = Math.min(2 + Math.floor(roundNumber / 2), 5);
    
    return players.map(p => {
      if (!p.isAlive) return p;
      
      const newItems = [...p.items];
      while (newItems.length < itemsPerPlayer) {
        const randomItem = itemPool[Math.floor(Math.random() * itemPool.length)];
        newItems.push(randomItem);
      }
      
      return { ...p, items: newItems };
    });
  };
  
  const leaveGame = () => {
    clearInterval(turnTimerInterval.value);
    unsubscribeGame.value?.();
    unsubscribeActions.value?.();
    currentGame.value = null;
    gameActions.value = [];
  };
  
  return {
    currentGame,
    gameActions,
    isLoading,
    error,
    turnTimeRemaining,
    gameId,
    isActive,
    currentPlayer,
    isMyTurn,
    myPlayer,
    amAlive,
    amSpectator,
    startGame,
    subscribeToGame,
    useItem,
    performShoot,
    endTurn,
    leaveGame
  };
});
```

---

## Phase 4: Vue Components

### 4.1 LobbyView.vue

```vue
<template>
  <div class="lobby-view">
    <div class="lobby-header">
      <h1>Room: {{ roomStore.roomId }}</h1>
      <div class="invite-section">
        <div class="invite-code">
          <span>Code: {{ roomStore.currentRoom?.inviteCode }}</span>
          <button @click="copyCode">Copy</button>
        </div>
        <div class="invite-link">
          <input :value="roomStore.currentRoom?.inviteLink" readonly />
          <button @click="copyLink">Copy Link</button>
        </div>
      </div>
    </div>
    
    <div class="players-grid">
      <PlayerCard
        v-for="player in roomStore.roomPlayers"
        :key="player.userId"
        :player="player"
        :is-host="roomStore.isHost"
        :is-me="player.userId === authStore.userId"
        @kick="roomStore.kickPlayer(player.userId)"
      />
      
      <!-- Empty slots -->
      <div 
        v-for="n in emptySlots" 
        :key="n"
        class="player-slot empty"
      >
        <span>Waiting...</span>
      </div>
    </div>
    
    <div class="lobby-actions">
      <button 
        v-if="!isReady"
        @click="setReady(true)"
        class="btn-ready"
      >
        Ready
      </button>
      <button 
        v-else
        @click="setReady(false)"
        class="btn-not-ready"
      >
        Not Ready
      </button>
      
      <button 
        v-if="roomStore.isHost"
        @click="startGame"
        :disabled="!roomStore.canStart"
        class="btn-start"
      >
        Start Game
      </button>
      
      <button @click="leaveRoom" class="btn-leave">
        Leave Room
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import PlayerCard from './PlayerCard.vue';

const router = useRouter();
const authStore = useAuthStore();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const isReady = computed(() => {
  const me = roomStore.roomPlayers.find(p => p.userId === authStore.userId);
  return me?.isReady || false;
});

const emptySlots = computed(() => {
  const max = roomStore.currentRoom?.maxPlayers || 4;
  return max - roomStore.roomPlayers.length;
});

const setReady = (ready) => {
  roomStore.setReady(ready);
};

const startGame = async () => {
  await gameStore.startGame();
  router.push('/game');
};

const leaveRoom = async () => {
  await roomStore.leaveRoom();
  router.push('/');
};

const copyCode = () => {
  navigator.clipboard.writeText(roomStore.currentRoom?.inviteCode);
};

const copyLink = () => {
  navigator.clipboard.writeText(roomStore.currentRoom?.inviteLink);
};
</script>

<style scoped>
.lobby-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.lobby-header {
  text-align: center;
  margin-bottom: 2rem;
}

.invite-section {
  margin-top: 1rem;
}

.invite-code, .invite-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.player-slot.empty {
  border: 2px dashed #666;
  border-radius: 8px;
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.lobby-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-ready { background: #4CAF50; color: white; }
.btn-not-ready { background: #ff9800; color: white; }
.btn-start { background: #2196F3; color: white; }
.btn-start:disabled { background: #ccc; cursor: not-allowed; }
.btn-leave { background: #f44336; color: white; }
</style>
```

### 4.2 GameHUD.vue

```vue
<template>
  <div class="game-hud">
    <!-- Turn Timer -->
    <TurnTimer 
      :time-remaining="gameStore.turnTimeRemaining"
      :is-my-turn="gameStore.isMyTurn"
    />
    
    <!-- Players -->
    <div class="players-container">
      <div 
        v-for="player in gameStore.currentGame?.players"
        :key="player.userId"
        :class="[
          'player-panel',
          { active: isCurrentPlayer(player) },
          { dead: !player.isAlive },
          { self: isMe(player) }
        ]"
      >
        <div class="player-avatar">
          <img :src="getAvatarUrl(player)" />
          <div v-if="isCurrentPlayer(player)" class="turn-indicator">
            TURN
          </div>
        </div>
        
        <div class="player-info">
          <span class="name">{{ player.displayName }}</span>
          <div class="health-bar">
            <div 
              class="health-fill"
              :style="{ width: (player.health / player.maxHealth * 100) + '%' }"
            />
            <span>{{ player.health }}/{{ player.maxHealth }}</span>
          </div>
        </div>
        
        <!-- Items (only show count for others, full for self) -->
        <div class="player-items">
          <span v-if="!isMe(player)">
            {{ player.items.length }} items
          </span>
          <div v-else class="my-items">
            <button
              v-for="item in player.items"
              :key="item"
              @click="selectItem(item)"
              :class="{ selected: selectedItem === item }"
            >
              {{ getItemIcon(item) }}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Shotgun Status -->
    <div class="shotgun-status">
      <div class="rounds-info">
        <span>{{ gameStore.currentGame?.shotgun?.liveRounds }} LIVE</span>
        <span>{{ gameStore.currentGame?.shotgun?.blankRounds }} BLANK</span>
        <span>{{ gameStore.currentGame?.shotgun?.chamber?.length }} LEFT</span>
      </div>
      <div v-if="gameStore.currentGame?.shotgun?.isSawedOff" class="sawed-off">
        SAWED OFF (2x DAMAGE)
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div v-if="gameStore.isMyTurn && gameStore.amAlive" class="action-panel">
      <button 
        v-if="canShoot"
        @click="openTargetSelector"
        class="btn-shoot"
      >
        SHOOT
      </button>
      <button 
        v-if="canUseItem && selectedItem"
        @click="useSelectedItem"
        class="btn-item"
      >
        USE {{ formatItemName(selectedItem) }}
      </button>
    </div>
    
    <!-- Game Log -->
    <GameLog :actions="gameStore.gameActions" />
    
    <!-- Target Selector Modal -->
    <TargetSelector
      v-if="showTargetSelector"
      :players="validTargets"
      @select="shootTarget"
      @cancel="showTargetSelector = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import TurnTimer from './TurnTimer.vue';
import GameLog from './GameLog.vue';
import TargetSelector from './TargetSelector.vue';

const gameStore = useGameStore();
const authStore = useAuthStore();

const selectedItem = ref(null);
const showTargetSelector = ref(false);

const isCurrentPlayer = (player) => {
  return gameStore.currentGame?.players[gameStore.currentGame?.currentTurn]?.userId === player.userId;
};

const isMe = (player) => player.userId === authStore.userId;

const canShoot = computed(() => {
  return !gameStore.currentGame?.turnContext?.hasShot;
});

const canUseItem = computed(() => {
  return gameStore.currentGame?.phase === 'item';
});

const validTargets = computed(() => {
  return gameStore.currentGame?.players.filter(p => 
    p.isAlive && p.userId !== authStore.userId
  );
});

const selectItem = (item) => {
  selectedItem.value = selectedItem.value === item ? null : item;
};

const useSelectedItem = async () => {
  if (!selectedItem.value) return;
  
  // Some items need target selection
  const needsTarget = ['handcuffs', 'adrenaline'].includes(selectedItem.value);
  
  if (needsTarget) {
    // Show target selector
    showTargetSelector.value = true;
    return;
  }
  
  await gameStore.useItem(selectedItem.value);
  selectedItem.value = null;
};

const openTargetSelector = () => {
  showTargetSelector.value = true;
};

const shootTarget = async (targetId) => {
  showTargetSelector.value = false;
  await gameStore.performShoot(targetId);
};

const getAvatarUrl = (player) => {
  return `/avatars/${player.avatar || 'default'}.png`;
};

const getItemIcon = (item) => {
  const icons = {
    handcuffs: '🔒',
    cigarette: '🚬',
    beer: '🍺',
    magnifying_glass: '🔍',
    hand_saw: '🪚',
    expired_medicine: '💊',
    inverter: '🔄',
    burner_phone: '📞',
    adrenaline: '💉'
  };
  return icons[item] || '❓';
};

const formatItemName = (item) => {
  return item.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
</script>

<style scoped>
.game-hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.game-hud > * {
  pointer-events: auto;
}

.players-container {
  display: flex;
  justify-content: space-around;
  padding: 1rem;
}

.player-panel {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 1rem;
  color: white;
  min-width: 150px;
  transition: all 0.3s;
}

.player-panel.active {
  border: 2px solid #4CAF50;
  box-shadow: 0 0 10px #4CAF50;
}

.player-panel.dead {
  opacity: 0.5;
  filter: grayscale(100%);
}

.player-panel.self {
  background: rgba(33, 150, 243, 0.7);
}

.turn-indicator {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #4CAF50;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
}

.health-bar {
  position: relative;
  height: 20px;
  background: #333;
  border-radius: 10px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, #f44336, #4CAF50);
  transition: width 0.3s;
}

.health-bar span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: bold;
}

.shotgun-status {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  text-align: center;
}

.rounds-info {
  display: flex;
  gap: 2rem;
  font-size: 1.2rem;
  font-weight: bold;
}

.sawed-off {
  color: #ff5722;
  margin-top: 0.5rem;
  font-weight: bold;
}

.action-panel {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
}

.btn-shoot {
  background: #f44336;
  color: white;
  padding: 1rem 3rem;
  font-size: 1.5rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.btn-item {
  background: #2196F3;
  color: white;
  padding: 1rem 2rem;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.my-items button {
  background: #333;
  border: 2px solid transparent;
  border-radius: 4px;
  padding: 0.5rem;
  margin: 0.25rem;
  cursor: pointer;
  font-size: 1.5rem;
}

.my-items button.selected {
  border-color: #4CAF50;
  background: #4CAF50;
}
</style>
```

### 4.3 TurnTimer.vue

```vue
<template>
  <div 
    class="turn-timer"
    :class="{ urgent: timeRemaining <= 10, 'my-turn': isMyTurn }"
  >
    <div class="timer-ring">
      <svg viewBox="0 0 100 100">
        <circle
          class="timer-bg"
          cx="50"
          cy="50"
          r="45"
        />
        <circle
          class="timer-progress"
          cx="50"
          cy="50"
          r="45"
          :style="{ strokeDashoffset: circumference - (timeRemaining / 30) * circumference }"
        />
      </svg>
      <span class="timer-text">{{ timeRemaining }}</span>
    </div>
    <span v-if="isMyTurn" class="turn-label">YOUR TURN</span>
    <span v-else class="turn-label">OPPONENT'S TURN</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  timeRemaining: Number,
  isMyTurn: Boolean
});

const circumference = 2 * Math.PI * 45;
</script>

<style scoped>
.turn-timer {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timer-ring {
  position: relative;
  width: 80px;
  height: 80px;
}

.timer-ring svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.timer-bg {
  fill: none;
  stroke: #333;
  stroke-width: 8;
}

.timer-progress {
  fill: none;
  stroke: #4CAF50;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: v-bind(circumference);
  transition: stroke-dashoffset 1s linear;
}

.turn-timer.urgent .timer-progress {
  stroke: #f44336;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
}

.turn-label {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #aaa;
  font-weight: bold;
}

.turn-timer.my-turn .turn-label {
  color: #4CAF50;
}
</style>
```

---

## Phase 5: Phaser Integration

### 5.1 GameScene.js

```javascript
import Phaser from 'phaser';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }
  
  preload() {
    // Load assets
    this.load.image('shotgun', 'assets/shotgun.png');
    this.load.image('shell-live', 'assets/shell_live.png');
    this.load.image('shell-blank', 'assets/shell_blank.png');
    this.load.image('shell-unknown', 'assets/shell_unknown.png');
    this.load.image('table', 'assets/table.png');
    this.load.spritesheet('player', 'assets/player_sprites.png', {
      frameWidth: 64,
      frameHeight: 64
    });
    
    // Effects
    this.load.spritesheet('muzzle-flash', 'assets/muzzle_flash.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet('blood', 'assets/blood.png', {
      frameWidth: 64,
      frameHeight: 64
    });
  }
  
  create() {
    // Get stores
    this.gameStore = useGameStore();
    this.authStore = useAuthStore();
    
    // Create background
    this.add.image(400, 300, 'table');
    
    // Create player avatars arranged in circle
    this.playerSprites = {};
    this.createPlayerAvatars();
    
    // Create shotgun
    this.shotgun = this.add.image(400, 300, 'shotgun');
    this.shotgun.setScale(0.5);
    
    // Create shell display
    this.shellDisplay = this.add.container(400, 500);
    this.updateShellDisplay();
    
    // Create animations
    this.createAnimations();
    
    // Subscribe to game state changes
    this.subscribeToGameState();
    
    // Input handling
    this.setupInput();
  }
  
  createPlayerAvatars() {
    const players = this.gameStore.currentGame?.players || [];
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    players.forEach((player, index) => {
      const angle = (index / players.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      const container = this.add.container(x, y);
      
      // Avatar sprite
      const avatar = this.add.sprite(0, 0, 'player', player.isAlive ? 0 : 4);
      avatar.setScale(2);
      container.add(avatar);
      
      // Health bar
      const healthBg = this.add.rectangle(0, -50, 60, 10, 0x333333);
      const healthFill = this.add.rectangle(
        -30 + (player.health / player.maxHealth) * 30,
        -50,
        (player.health / player.maxHealth) * 60,
        10,
        player.userId === this.authStore.userId ? 0x2196F3 : 0x4CAF50
      );
      healthFill.setOrigin(0, 0.5);
      container.add([healthBg, healthFill]);
      
      // Name label
      const nameText = this.add.text(0, 50, player.displayName, {
        fontSize: '14px',
        fill: '#fff',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5);
      container.add(nameText);
      
      // Turn indicator
      if (index === this.gameStore.currentGame?.currentTurn) {
        const indicator = this.add.circle(0, -70, 8, 0xFFD700);
        indicator.setStrokeStyle(2, 0xFFFFFF);
        this.tweens.add({
          targets: indicator,
          scale: 1.2,
          duration: 500,
          yoyo: true,
          repeat: -1
        });
        container.add(indicator);
      }
      
      // Items indicator
      if (player.items.length > 0) {
        const itemBadge = this.add.circle(30, -30, 12, 0xFF5722);
        const itemCount = this.add.text(30, -30, player.items.length.toString(), {
          fontSize: '12px',
          fill: '#fff'
        }).setOrigin(0.5);
        container.add([itemBadge, itemCount]);
      }
      
      this.playerSprites[player.userId] = {
        container,
        avatar,
        healthFill,
        data: player
      };
    });
  }
  
  createAnimations() {
    // Muzzle flash animation
    this.anims.create({
      key: 'muzzle-flash',
      frames: this.anims.generateFrameNumbers('muzzle-flash', { start: 0, end: 5 }),
      frameRate: 20,
      hideOnComplete: true
    });
    
    // Blood splatter
    this.anims.create({
      key: 'blood-splatter',
      frames: this.anims.generateFrameNumbers('blood', { start: 0, end: 7 }),
      frameRate: 15,
      hideOnComplete: true
    });
    
    // Player hit reaction
    this.anims.create({
      key: 'player-hit',
      frames: this.anims.generateFrameNumbers('player', { start: 1, end: 3 }),
      frameRate: 10,
      yoyo: true
    });
    
    // Player death
    this.anims.create({
      key: 'player-die',
      frames: this.anims.generateFrameNumbers('player', { start: 4, end: 7 }),
      frameRate: 8
    });
  }
  
  updateShellDisplay() {
    this.shellDisplay.removeAll(true);
    
    const shotgun = this.gameStore.currentGame?.shotgun;
    if (!shotgun) return;
    
    const isSpectator = this.gameStore.amSpectator;
    const chamber = shotgun.chamber;
    
    chamber.forEach((round, index) => {
      const x = (index - chamber.length / 2) * 40;
      const texture = isSpectator ? 'shell-unknown' : `shell-${round}`;
      const shell = this.add.image(x, 0, texture);
      shell.setScale(0.3);
      this.shellDisplay.add(shell);
    });
  }
  
  subscribeToGameState() {
    // Watch for changes and trigger animations
    let lastActionCount = 0;
    
    this.events.on('update', () => {
      const actions = this.gameStore.gameActions;
      
      if (actions.length > lastActionCount) {
        const newActions = actions.slice(lastActionCount);
        newActions.forEach(action => this.handleAction(action));
        lastActionCount = actions.length;
      }
      
      // Update shell display when chamber changes
      this.updateShellDisplay();
    });
  }
  
  handleAction(action) {
    switch (action.type) {
      case 'shoot':
        this.animateShoot(action);
        break;
      case 'item_use':
        this.animateItemUse(action);
        break;
      case 'player_died':
        this.animateDeath(action.playerId);
        break;
    }
  }
  
  animateShoot(action) {
    const shooter = this.playerSprites[action.playerId];
    const target = this.playerSprites[action.targetId];
    
    if (!shooter || !target) return;
    
    // Aim shotgun at target
    const angle = Phaser.Math.Angle.Between(
      shooter.container.x, shooter.container.y,
      target.container.x, target.container.y
    );
    
    this.tweens.add({
      targets: this.shotgun,
      angle: Phaser.Math.RadToDeg(angle),
      duration: 300
    });
    
    // Fire after aim
    this.time.delayedCall(300, () => {
      // Muzzle flash
      const flash = this.add.sprite(
        shooter.container.x + Math.cos(angle) * 60,
        shooter.container.y + Math.sin(angle) * 60,
        'muzzle-flash'
      );
      flash.setRotation(angle);
      flash.play('muzzle-flash');
      
      // Screen shake
      this.cameras.main.shake(200, action.result.roundType === 'live' ? 0.01 : 0.005);
      
      // Hit effect if live
      if (action.result.roundType === 'live') {
        this.time.delayedCall(100, () => {
          // Blood splatter
          const blood = this.add.sprite(target.container.x, target.container.y, 'blood');
          blood.play('blood-splatter');
          
          // Player hit animation
          target.avatar.play('player-hit');
          
          // Flash red
          this.tweens.add({
            targets: target.container,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2
          });
        });
      }
      
      // Reset shotgun
      this.time.delayedCall(500, () => {
        this.tweens.add({
          targets: this.shotgun,
          angle: 0,
          duration: 300
        });
      });
    });
  }
  
  animateItemUse(action) {
    const user = this.playerSprites[action.playerId];
    if (!user) return;
    
    // Show item icon floating up
    const itemIcons = {
      handcuffs: '🔒',
      cigarette: '🚬',
      beer: '🍺',
      magnifying_glass: '🔍',
      hand_saw: '🪚',
      expired_medicine: '💊',
      inverter: '🔄',
      burner_phone: '📞',
      adrenaline: '💉'
    };
    
    const icon = this.add.text(user.container.x, user.container.y - 50, 
      itemIcons[action.itemUsed] || '❓', {
        fontSize: '32px'
      }
    ).setOrigin(0.5);
    
    this.tweens.add({
      targets: icon,
      y: user.container.y - 100,
      alpha: 0,
      duration: 1000,
      onComplete: () => icon.destroy()
    });
    
    // Special effects for specific items
    if (action.itemUsed === 'cigarette') {
      // Heal effect
      const heal = this.add.text(user.container.x, user.container.y, '+1', {
        fontSize: '24px',
        fill: '#4CAF50',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0.5);
      
      this.tweens.add({
        targets: heal,
        y: user.container.y - 60,
        alpha: 0,
        duration: 1000,
        onComplete: () => heal.destroy()
      });
    }
  }
  
  animateDeath(playerId) {
    const player = this.playerSprites[playerId];
    if (!player) return;
    
    player.avatar.play('player-die');
    
    // Fade out
    this.tweens.add({
      targets: player.container,
      alpha: 0.3,
      duration: 1000
    });
  }
  
  setupInput() {
    // Click on player to select target
    Object.entries(this.playerSprites).forEach(([playerId, spriteData]) => {
      spriteData.container.setInteractive();
      spriteData.container.on('pointerdown', () => {
        if (this.gameStore.isMyTurn && this.gameStore.amAlive) {
          // Emit event for Vue component to handle
          this.game.events.emit('player-selected', playerId);
        }
      });
    });
  }
  
  update() {
    // Continuous updates if needed
  }
}
```

---

## Phase 6: Cloud Functions

### 6.1 Firebase Functions Setup

**File: `functions/index.js`**

```javascript
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// AFK Detection: Check for inactive players every 30 seconds
exports.checkAfkPlayers = onSchedule('every 30 seconds', async (event) => {
  const now = Date.now();
  const afkThreshold = 30 * 1000; // 30 seconds
  
  // Check rooms for AFK players
  const roomsSnapshot = await db.collection('rooms')
    .where('status', 'in', ['waiting', 'playing'])
    .get();
  
  for (const roomDoc of roomsSnapshot.docs) {
    const roomId = roomDoc.id;
    const playersSnapshot = await db.collection('rooms', roomId, 'players').get();
    
    for (const playerDoc of playersSnapshot.docs) {
      const player = playerDoc.data();
      const lastPing = player.lastPing?.toMillis() || 0;
      
      if (now - lastPing > afkThreshold && player.status === 'active') {
        // Mark as disconnected
        await playerDoc.ref.update({
          status: 'disconnected',
          disconnectedAt: new Date()
        });
        
        // If in active game, handle disconnection
        const gameDoc = await db.collection('games').doc(roomId).get();
        if (gameDoc.exists && gameDoc.data().status === 'active') {
          await handlePlayerDisconnect(roomId, player.userId);
        }
      }
    }
  }
});

// Handle player disconnect during game
async function handlePlayerDisconnect(gameId, playerId) {
  const gameRef = db.collection('games').doc(gameId);
  const game = await gameRef.get();
  
  if (!game.exists) return;
  
  const gameData = game.data();
  
  // Mark player as disconnected in game
  const updatedPlayers = gameData.players.map(p =>
    p.userId === playerId ? { ...p, isConnected: false } : p
  );
  
  await gameRef.update({ players: updatedPlayers });
  
  // If it's their turn, skip to next player
  const currentPlayer = gameData.players[gameData.currentTurn];
  if (currentPlayer?.userId === playerId) {
    await skipTurn(gameId);
  }
  
  // Check if game should end (only one player left connected)
  const connectedPlayers = updatedPlayers.filter(p => p.isConnected && p.isAlive);
  if (connectedPlayers.length <= 1) {
    await endGame(gameId, connectedPlayers[0] || null);
  }
}

// Skip current turn
async function skipTurn(gameId) {
  const gameRef = db.collection('games').doc(gameId);
  const game = await gameRef.get();
  const gameData = game.data();
  
  let nextTurn = gameData.currentTurn;
  do {
    nextTurn = (nextTurn + 1) % gameData.players.length;
  } while (!gameData.players[nextTurn]?.isAlive);
  
  await gameRef.update({
    currentTurn: nextTurn,
    turnStartedAt: new Date(),
    'turnContext.playerId': gameData.players[nextTurn].userId,
    'turnContext.timeRemaining': 30
  });
}

// End game
async function endGame(gameId, winner) {
  const batch = db.batch();
  
  // Update game
  const gameRef = db.collection('games').doc(gameId);
  batch.update(gameRef, {
    status: 'ended',
    endedAt: new Date(),
    winner: winner ? {
      userId: winner.userId,
      displayName: winner.displayName
    } : null
  });
  
  // Update room
  const roomRef = db.collection('rooms').doc(gameId);
  batch.update(roomRef, {
    status: 'ended',
    updatedAt: new Date()
  });
  
  await batch.commit();
}

// Cleanup old rooms (runs daily)
exports.cleanupOldRooms = onSchedule('every day 00:00', async (event) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const oldRooms = await db.collection('rooms')
    .where('updatedAt', '<', oneDayAgo)
    .get();
  
  const batch = db.batch();
  
  for (const roomDoc of oldRooms.docs) {
    batch.delete(roomDoc.ref);
    
    // Also delete associated game if exists
    const gameDoc = await db.collection('games').doc(roomDoc.id).get();
    if (gameDoc.exists) {
      batch.delete(gameDoc.ref);
    }
  }
  
  await batch.commit();
});

// Log game actions for analytics
exports.logGameAction = onDocumentCreated('games/{gameId}/actions/{actionId}', async (event) => {
  const action = event.data.data();
  
  // Could send to analytics service
  console.log('Game action:', {
    gameId: event.params.gameId,
    type: action.type,
    timestamp: action.timestamp
  });
});
```

---

## Phase 7: Routing & App Structure

### 7.1 Vue Router Configuration

**File: `src/router/index.js`**

```javascript
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useRoomStore } from '@/stores/roomStore';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/join/:code',
    name: 'Join',
    component: () => import('@/views/JoinView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/lobby',
    name: 'Lobby',
    component: () => import('@/views/LobbyView.vue'),
    meta: { requiresAuth: true, requiresRoom: true }
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('@/views/GameView.vue'),
    meta: { requiresAuth: true, requiresGame: true }
  },
  {
    path: '/spectate/:gameId',
    name: 'Spectate',
    component: () => import('@/views/SpectateView.vue'),
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const roomStore = useRoomStore();
  
  // Ensure auth is initialized
  if (!authStore.isAuthenticated) {
    await authStore.initAuth();
  }
  
  // Redirect to home if not authenticated
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    await authStore.signInAnonymous();
  }
  
  // Check room requirement
  if (to.meta.requiresRoom && !roomStore.isInRoom) {
    return next('/');
  }
  
  // Check game requirement
  if (to.meta.requiresGame && !roomStore.currentRoom?.status === 'playing') {
    return next('/lobby');
  }
  
  next();
});

export default router;
```

### 7.2 Main App Entry

**File: `src/main.js`**

```javascript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './config/firebase';

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
```

---

## Phase 8: Implementation Timeline

| Phase | Task | Duration | Dependencies |
|-------|------|----------|--------------|
| 1 | Firebase project setup | 2 hours | - |
| 1 | Environment configuration | 1 hour | Phase 1.1 |
| 2 | Database schema design | 4 hours | Phase 1 |
| 2 | Security rules | 2 hours | Phase 2.1 |
| 3 | Auth store implementation | 3 hours | Phase 1 |
| 3 | Room store implementation | 6 hours | Phase 3.1 |
| 3 | Game store implementation | 8 hours | Phase 3.2 |
| 4 | Lobby UI components | 6 hours | Phase 3 |
| 4 | Game HUD components | 8 hours | Phase 3 |
| 5 | Phaser scene integration | 10 hours | Phase 3 |
| 5 | Animation system | 6 hours | Phase 5.1 |
| 6 | Cloud functions | 4 hours | Phase 2 |
| 7 | Routing & navigation | 2 hours | Phase 3-4 |
| 8 | Testing & debugging | 8 hours | All |
| 8 | Deployment | 2 hours | All |

**Total Estimated Time: 72 hours (9 working days)**

---

## Phase 9: Testing Checklist

### 9.1 Unit Tests

```javascript
// Example test structure

describe('GameStore', () => {
  test('generateShotgun creates correct chamber', () => {
    const shotgun = generateShotgun(2, 4);
    expect(shotgun.chamber).toHaveLength(6);
    expect(shotgun.liveRounds).toBe(2);
    expect(shotgun.blankRounds).toBe(4);
  });
  
  test('calculateInitialHealth scales with player count', () => {
    expect(calculateInitialHealth(2)).toBe(6);
    expect(calculateInitialHealth(4)).toBe(4);
    expect(calculateInitialHealth(8)).toBe(3);
  });
});

describe('RoomStore', () => {
  test('generateRoomCode creates 6-character code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });
});
```

### 9.2 Integration Tests

- [ ] Anonymous authentication works
- [ ] Room creation generates valid invite code
- [ ] Players can join via code
- [ ] Players can join via link
- [ ] Host can kick players
- [ ] Ready state synchronization
- [ ] Game starts when all ready
- [ ] Turn order is correct
- [ ] Shotgun chamber generates correctly
- [ ] Shooting deals correct damage
- [ ] Items apply correct effects
- [ ] Turn timer counts down
- [ ] AFK player gets skipped
- [ ] Disconnected player is handled
- [ ] Spectators can view game
- [ ] Game ends correctly

### 9.3 Manual Testing Scenarios

1. **2-player game** - Full match
2. **4-player game** - Full match with items
3. **8-player game** - Verify performance
4. **Player disconnection** - Mid-turn and between turns
5. **Host leaves** - Transfer ownership
6. **All players leave** - Room cleanup
7. **Spectator joins mid-game** - Correct state display

---

## Phase 10: Deployment

### 10.1 Build Configuration

**File: `vue.config.js`**

```javascript
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: './',
  outputDir: 'dist',
  configureWebpack: {
    resolve: {
      alias: {
        '@': require('path').resolve(__dirname, 'src')
      }
    }
  }
});
```

### 10.2 Firebase Hosting Configuration

**File: `firebase.json`**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions"
    }
  ]
}
```

### 10.3 Deployment Commands

```bash
# Build production
npm run build

# Deploy to Firebase
firebase deploy

# Or deploy specific services
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only functions
```

---

## Appendix A: Item Reference

| Item | Effect | Target Required |
|------|--------|-----------------|
| Handcuffs | Skip target's next turn | Yes |
| Cigarette | Restore 1 health | No |
| Beer | Eject and reveal current round | No |
| Magnifying Glass | See current round | No |
| Hand Saw | Double damage next shot | No |
| Expired Medicine | 50% heal 2, 50% lose 1 | No |
| Inverter | Flip current round | No |
| Burner Phone | Reveal random future round | No |
| Adrenaline | Steal item from target | Yes |

---

## Appendix B: Error Handling

```javascript
// Global error handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Send to error tracking service
});

// Firebase error codes mapping
const FIREBASE_ERRORS = {
  'permission-denied': 'You don\'t have permission for this action',
  'not-found': 'The requested resource was not found',
  'already-exists': 'This resource already exists',
  'resource-exhausted': 'Too many requests, please try again later',
  'failed-precondition': 'The operation failed due to the current system state',
  'aborted': 'The operation was aborted',
  'out-of-range': 'The operation was attempted past the valid range',
  'unimplemented': 'This operation is not implemented',
  'internal': 'An internal error occurred',
  'unavailable': 'The service is currently unavailable',
  'data-loss': 'Unrecoverable data loss or corruption',
  'unauthenticated': 'You must be signed in to perform this action'
};
```

---

## Appendix C: Performance Optimizations

1. **Use Firestore offline persistence**
```javascript
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB
  }
});
```

2. **Limit listener scope**
```javascript
// Only listen to necessary fields
onSnapshot(doc(db, 'games', gameId), { 
  includeMetadataChanges: false 
}, (doc) => {
  // Handle update
});
```

3. **Debounced writes for rapid actions**
```javascript
import { debounce } from 'lodash-es';

const debouncedUpdate = debounce((ref, data) => {
  updateDoc(ref, data);
}, 100);
```

---

**Document Version: 1.0**
**Last Updated: 2024**
**Author: AI Implementation Agent**



====================================================================
ADDENDUM — SENIOR REVIEW & HARDENING NOTES
====================================================================

This addendum DOES NOT replace the original plan.
It extends and hardens it with minimal architectural changes,
based on real-world multiplayer failure modes (latency, refresh,
duplicate writes, mobile backgrounding).

The original document remains the source of truth.

--------------------------------------------------------------------
A. CLARIFICATION: TURN-BASED LOGIC VS NETWORK REALITY
--------------------------------------------------------------------

The turn flow defined in the original plan is correct at the game-rule level,
but network serialization must still be enforced at the data layer.

--------------------------------------------------------------------
B. REQUIRED GUARANTEES
--------------------------------------------------------------------

- Exactly one action resolved per turn
- No duplicate resolution after refresh or double click
- No stale turn writes

--------------------------------------------------------------------
C. TURN LOCK (ADDITIVE)
--------------------------------------------------------------------

Add a turnLock object to games/{gameId} to prevent concurrent resolution.

--------------------------------------------------------------------
D. TURN IDENTIFIER (ADDITIVE)
--------------------------------------------------------------------

Add a monotonic turnNumber and require it on all intents.

--------------------------------------------------------------------
E. EXPLICIT GAME PHASE (ADDITIVE)
--------------------------------------------------------------------

Formalize phases:
LOADING, ROUND_START, TURN_START, AWAIT_ACTION,
RESOLVING_ACTION, ROUND_END, GAME_OVER

--------------------------------------------------------------------
F. INTENT-BASED ACTION FLOW
--------------------------------------------------------------------

Clients emit intents; authoritative layer resolves state.

--------------------------------------------------------------------
G. TRANSACTION-ONLY MODE
--------------------------------------------------------------------

Firestore transactions are sufficient for friends-only mode.

--------------------------------------------------------------------
H. RECONNECT & REFRESH SEMANTICS
--------------------------------------------------------------------

Track sessionId and lastSeenAt to avoid replay bugs.

--------------------------------------------------------------------
I. SPECTATORS
--------------------------------------------------------------------

Spectators are read-only and receive full snapshots.

--------------------------------------------------------------------
J. CLOUD FUNCTION UPGRADE PATH
--------------------------------------------------------------------

Upgrade when adding public matchmaking or ranked play.

--------------------------------------------------------------------
K. FINAL VERDICT
--------------------------------------------------------------------

Original plan remains valid.
This addendum addresses real-world edge cases without removing details.

====================================================================
END OF ADDENDUM
====================================================================
