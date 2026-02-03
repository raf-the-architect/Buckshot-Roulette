# Buckshot Roulette Multiplayer Implementation Plan

## Goal
Transform the existing single-player Buckshot Roulette game into a 1-8 player online multiplayer experience using Firebase (Firestore + Auth + Cloud Functions).

## Current State Analysis

The existing codebase is a **vanilla Vue 3 + Phaser 3** application:
- Entry point: `src/main.js` using Vue CDN
- Game engine: `GameScene.js` with modular managers
- Core logic: `gameLogic.js` with state management functions
- Firebase: Already initialized in `index.html` with Analytics only
- **No npm/package.json** - uses CDN for dependencies

---

## User Review Required

> [!IMPORTANT]
> **This is a large-scale transformation** (~72 hours estimated per the original plan). The implementation will add significant complexity to the codebase.

> [!WARNING]
> **The current app uses CDN-based Vue/Phaser without npm.** The implementation plan assumes adding npm/Vite for proper module bundling with Pinia and Firebase. **Do you want to:**
> 1. **Migrate to Vite/npm** - Better for Firebase modules, Pinia, and future development
> 2. **Keep CDN approach** - Add Pinia and Firebase via CDN (limited features)

> [!CAUTION]
> **Firebase credentials are currently exposed in index.html.** This should be moved to environment variables during the migration.

---

## Proposed Changes

### Phase 1: Project Setup & Firebase Configuration

#### [NEW] package.json
- Initialize npm project with Vite
- Add dependencies: `firebase`, `pinia`, `vue-router`
- Configure build scripts

#### [NEW] vite.config.js
- Vite configuration for Vue 3

#### [MODIFY] [index.html](file:///Users/achraf/Documents/Projects/Buckshot-Roulette/src/index.html)
- Remove inline Firebase config
- Update script imports for bundled modules

#### [NEW] src/config/firebase.js
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
// Firebase initialization and exports
```

#### [NEW] .env.local
- Firebase API keys and configuration

---

### Phase 2: Database Schema

#### [NEW] firestore.rules
- Security rules for `users`, `rooms`, `games` collections
- Player validation and host permissions

#### [NEW] firestore.indexes.json
- Query optimization indexes

---

### Phase 3: Pinia State Management

#### [NEW] src/stores/authStore.js
- Anonymous authentication
- User profile management (displayName, avatar, stats)
- `initAuth()`, `signInAnonymous()`, `updateLastActive()`

#### [NEW] src/stores/roomStore.js
- Room creation with invite codes
- Player join/leave management
- Ready state synchronization
- `createRoom()`, `joinRoom()`, `setReady()`, `leaveRoom()`

#### [NEW] src/stores/gameStore.js
- Multiplayer game state
- Turn management and timer
- Item usage and shooting
- Firebase realtime listeners
- `startGame()`, `useItem()`, `performShoot()`, `endTurn()`

---

### Phase 4: Vue Components

#### [NEW] src/components/LobbyView.vue
- Room code display and sharing
- Player grid with ready states
- Host controls (start game, kick players)

#### [NEW] src/components/PlayerCard.vue
- Player avatar, name, ready state
- Host badge and kick button

#### [NEW] src/components/GameHUD.vue
- Multiplayer player panels
- Turn timer integration
- Item selection and action buttons

#### [NEW] src/components/TurnTimer.vue
- Circular countdown timer
- Visual urgency indicators

#### [NEW] src/components/TargetSelector.vue
- Modal for selecting shoot target
- Valid target filtering

#### [NEW] src/components/GameLog.vue
- Recent actions display

---

### Phase 5: Game Logic Integration

#### [MODIFY] [gameLogic.js](file:///Users/achraf/Documents/Projects/Buckshot-Roulette/src/game/gameLogic.js)
- Add support for 2-8 players
- Add `turnLock` for concurrent action prevention
- Add `turnNumber` for intent validation
- Update `createInitialState()` for variable player count
- Update item effects for multiplayer targeting

#### [MODIFY] [GameScene.js](file:///Users/achraf/Documents/Projects/Buckshot-Roulette/src/game/GameScene.js)
- Connect to Pinia gameStore
- Subscribe to Firebase realtime updates
- Trigger animations based on remote actions

---

### Phase 6: Cloud Functions

#### [NEW] functions/index.js
- `checkAfkPlayers` - Scheduled function every 30s
- `cleanupOldRooms` - Daily cleanup of stale rooms
- `logGameAction` - Analytics logging

---

### Phase 7: Routing

#### [NEW] src/router/index.js
- Home route (/)
- Join route (/join/:code)
- Lobby route (/lobby)
- Game route (/game)
- Route guards for auth and room requirements

---

## Verification Plan

### Manual Testing (Primary)

Since this is a multiplayer game, automated testing is limited. The following manual tests are required:

1. **Authentication Test**
   - Open the app in an incognito window
   - Verify anonymous auth occurs automatically
   - Check Firestore for user document creation

2. **Room Creation Test**
   - Create a new room
   - Verify 6-character room code is generated
   - Copy invite link and verify it works in another browser

3. **Player Join Test**
   - Open app in two browser windows
   - Create room in window 1
   - Join room via code in window 2
   - Verify both windows show 2 players

4. **Game Start Test**
   - Both players mark ready
   - Host clicks start
   - Verify game state syncs in both windows

5. **Turn Flow Test**
   - Verify only current player can take actions
   - Verify shooting updates health in real-time
   - Verify turn switches correctly

6. **Item Usage Test**
   - Use each item type
   - Verify effects apply across all clients

7. **Disconnection Test**
   - Close one browser window mid-game
   - Verify other player is notified
   - Verify turn skipping for disconnected player

### Browser Testing Commands

```bash
# Start local development server
npm run dev

# Start Firebase emulators for local testing
firebase emulators:start
```

> [!TIP]
> **Suggestion for the user:** I recommend testing with 2-3 browser windows simultaneously. You can use Chrome incognito mode for additional test users since each incognito window gets a unique anonymous auth session.

---

## Implementation Order

1. **Phase 1** - Project setup with npm/Vite *(blocks everything)*
2. **Phase 3** - Pinia stores *(can be done in parallel with Phase 2)*
3. **Phase 2** - Firebase rules deployment
4. **Phase 4** - Vue components *(requires Phase 3)*
5. **Phase 5** - Game logic *(requires Phase 3, 4)*
6. **Phase 6** - Cloud Functions *(can be done anytime after Phase 1)*
7. **Phase 7** - Routing *(requires Phase 4)*
8. **Phase 8** - Testing & deployment

---

## Questions for You

1. **Vite Migration**: Should I proceed with migrating to npm/Vite, or keep the CDN approach?

2. **Scope**: Do you want me to implement all 8 phases, or would you prefer to start with a minimal viable multiplayer (e.g., just 2-player support)?

3. **Player Count**: The plan supports 1-8 players. Do you want to simplify to 2-player only initially?

4. **Cloud Functions**: These require Firebase Blaze plan (pay-as-you-go). Do you have this set up, or should I skip Cloud Functions for now?
