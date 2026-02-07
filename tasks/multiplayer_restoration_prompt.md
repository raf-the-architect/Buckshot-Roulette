# Multiplayer Restoration & UI Preservation Prompt

## Role & Mindset

You are acting as a **senior game engineer** joining an existing project mid-development.
Your task is **bug fixing and restoration**, NOT refactoring or redesign.

This project was originally a **fully working offline single-player game** with a stable UI.
Multiplayer work was started but **broke both offline and online modes**.

**Critical rule:**
DO NOT redesign UI, DO NOT add features, DO NOT refactor architecture.
Your mission is to **restore functionality with the smallest possible changes**.

---

## Goal (Critical)

Restore the game so that:

1. **Offline mode works exactly like the original version**
   - Same UI
   - Same layout
   - Same assets
   - Same animations
   - Same item behavior
   - Same turn flow

2. **Online multiplayer works ONLY for 2 players**
   - Player 1 vs Player 2
   - No bots
   - No spectators
   - No 3+ players

3. **UI must remain IDENTICAL**
   - Second player replaces the bot
   - No new UI elements
   - No removed UI elements
   - No layout changes

4. **Multiplayer logic already exists**
   - DO NOT rewrite it
   - Only FIX bugs and broken state flow

---

## Context Provided

You have access to:
- Original working offline version
- Current broken staged changes
- Multiplayer implementation plan
- TODO list
- Git diff (staged vs original)

No changes have been committed yet.

---

## Required Strategy

### 1. Identify Last Known Good State
- Locate the version where:
  - Offline mode works
  - UI matches original screenshots
- Treat this as baseline

### 2. Compare Staged Changes
- Identify:
  - What broke offline mode
  - What broke UI state
  - What broke turn ownership
  - What broke avatar binding

### 3. Restore Offline Mode First
- Offline must work 100%
- Bot logic restored
- UI pixel-identical to original

### 4. Fix Multiplayer with Minimal Changes
- Adapt:
  - Turn ownership
  - Player identity mapping
- Reuse:
  - Same UI slots
  - Same avatars
  - Same HUD
- Player 2 replaces bot visually and logically

---

## Hard Constraints

- No refactoring
- No new UI
- No new assets
- No rule changes
- No framework changes
- No optimization passes

If something works, **do not touch it**.

---

## Multiplayer Rules (Version 1)

- Exactly 2 players
- Strict turn-based
- One active player at a time
- Client acts only if authorized
- No simultaneous actions

---

## State Model Invariant

Exactly one active player.
Exactly one authoritative game state.
UI reflects state, never drives it.

Offline:
Player vs Bot

Online:
Player vs Player (same UI)

---

## Validation Checklist

- Offline mode works start to finish
- UI matches original screenshots
- Items behave identically
- Turns switch correctly
- Ammo UI correct
- Online 2-player works
- Player 2 replaces bot
- No console errors
- No stuck turns

---

## Final Deliverables

1. Fixed working code
2. Explanation of:
   - What broke
   - Why it broke
   - What was changed
3. Confirmation:
   - Offline restored
   - Online 2-player works
   - UI unchanged

---

## Reminder

This is **surgical repair**, not a rewrite.

If unsure:
**DO NOT CHANGE IT.**
