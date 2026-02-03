# Buckshot Roulette Multiplayer Implementation

## Overview
Transform single-player Buckshot Roulette into 1-8 player online multiplayer using Firebase.

---

## Phase 1: Firebase Setup & Configuration
- [/] Install Firebase CLI and initialize project
- [ ] Create `src/config/firebase.js` with proper Firebase SDK imports
- [ ] Set up environment variables for Firebase config
- [ ] Enable Anonymous Authentication in Firebase Console
- [ ] Create Firestore database and deploy security rules

---

## Phase 2: Database Schema & Security Rules
- [ ] Create `firestore.rules` with all collection permissions
- [ ] Create `firestore.indexes.json` for query optimization
- [ ] Deploy security rules to Firebase

---

## Phase 3: Pinia Stores
- [ ] Add Pinia to the project (CDN or npm setup)
- [ ] Create `authStore.js` - user authentication & profiles
- [ ] Create `roomStore.js` - lobby/room management
- [ ] Create `gameStore.js` - multiplayer game state
- [ ] Create `uiStore.js` - UI state management

---

## Phase 4: Vue Components
- [ ] Create `LobbyView.vue` - room management UI
- [ ] Create `PlayerCard.vue` - player display component
- [ ] Create `GameHUD.vue` - multiplayer game HUD
- [ ] Create `TurnTimer.vue` - turn countdown component
- [ ] Create `GameLog.vue` - action history display
- [ ] Create `TargetSelector.vue` - player targeting modal
- [ ] Update routing to support multiplayer flow

---

## Phase 5: Phaser Integration
- [ ] Modify `GameScene.js` to work with Pinia stores
- [ ] Add multiplayer state synchronization to game scene
- [ ] Update player rendering for multiple human players
- [ ] Connect action animations to Firebase events

---

## Phase 6: Cloud Functions
- [ ] Set up Firebase Functions locally
- [ ] Create AFK detection function
- [ ] Create room cleanup function
- [ ] Create game action logging function
- [ ] Deploy functions to Firebase

---

## Phase 7: Core Game Logic
- [ ] Modify `gameLogic.js` for multiplayer support
- [ ] Add turn validation for network play
- [ ] Implement intent-based action flow
- [ ] Add reconnect/refresh handling

---

## Phase 8: Testing & Deployment
- [ ] Test 2-player game flow
- [ ] Test room creation and joining
- [ ] Test disconnection handling
- [ ] Deploy to Firebase Hosting
