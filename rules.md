# Buckshot Roulette — Complete Rules Reference

This document is a cleaned, corrected, and consolidated rules reference for **Buckshot Roulette**, based strictly on observed gameplay and public documentation (Wikipedia and the Buckshot Roulette Wiki).

---

## 1. Overview

**Buckshot Roulette** is a turn-based game inspired by Russian roulette, replacing a revolver with a **pump-action shotgun** loaded with a randomized mix of **live shells** and **blanks**.  
The player faces the **Dealer** in escalating rounds governed by limited lives (defibrillator charges) and forced shooting decisions. From Round 2 onward, items are introduced that add information, control, and risk manipulation.

Core loop:

1. Load randomized shotgun magazine
2. Take turns choosing a target (self or opponent)
3. Fire the next shell
4. Resolve damage and turn control
5. Repeat until one side runs out of charges

---

## 2. Components & Game State

### Core Components

- **Shotgun** — Holds an ordered magazine of shells
- **Shells**
  - **Live shell (red)** — Causes damage
  - **Blank shell (blue/gray)** — No damage; may allow continued play
- **Defibrillator charges** — Lives per round
- **Items** — Consumables introduced from Round 2 onward
- **Dealer** — AI opponent

### Key State Variables

- Current round number
- Ordered shell list
- Current turn owner
- Charges per participant
- Shotgun possession
- Item inventories (max 8 per actor)

---

## 3. Game Setup

### Single-Player Mode

- The game consists of **three main rounds**
- At the start of each round, the Dealer loads the shotgun with a predefined number of live shells and blanks in a **random order**
- The Dealer controls the shotgun at the beginning of each round, but the **player acts first**

### Round Progression

- **Round 1**
  - Few shells
  - Few defibrillator charges
  - No items
- **Round 2**
  - More shells
  - More charges
  - Items introduced
- **Round 3**
  - Highest stakes
  - Sudden-death rules apply

---

## 4. Turn Structure

Each turn proceeds as follows:

1. **Item Use Phase (optional)**  
   The active actor may use any eligible items.
2. **Shoot Decision (mandatory)**  
   The actor must choose to:
   - Shoot the opponent, or
   - Shoot themselves
3. **Shell Resolution**  
   The next shell in the magazine is fired and revealed.
4. **Outcome Resolution**  
   Damage, turn control, and round-end conditions are applied.

---

## 5. Shell Outcomes

### Live Shell

- Target loses **one defibrillator charge**
- **Shotgun control transfers to the Dealer**
- If charges reach zero:
  - The round ends
  - In Round 3, loss is permanent

### Blank Shell

- Causes **no damage**
- If the shooter targets **themselves**, they **retain the turn**
- Blank shells never cause damage

### Empty Magazine

- If the magazine empties with no round loss:
  - The Dealer reloads a new randomized magazine
  - Play continues

---

## 6. Defibrillator Charges & Death

- Charges represent survivable live hits
- When charges reach zero, the round is lost

### Respawn Rules

- **Rounds 1 & 2:** Round loss only
- **Round 3:** Sudden death — loss ends the run

---

## 7. Items

- Introduced in **Round 2**
- Randomly distributed to player and Dealer
- **Maximum inventory size: 8**
- Items are single-use unless stated otherwise

### Item Categories

- Information (reveal shells)
- Turn manipulation
- Damage mitigation or recovery
- Randomization control

Exact item timing and behavior are defined per-item in community documentation.

---

## 8. Double or Nothing Mode

Unlocked after defeating the Dealer.

- Endless escalating rounds
- Randomized items and charges
- Exclusive items:
  - Burner Phone
  - Inverter
  - Adrenaline
  - Expired Medicine
- Rewards increase exponentially
- Losing forfeits the run

---

## 9. Multiplayer Notes

- Supports up to **4 players**
- Shotgun possession rotates between players
- Multiplayer-only items include:
  - Jammer
  - Remote
- Core shell and damage rules remain unchanged

---

## 10. Implementation Notes

- Magazine order must be deterministic once loaded
- Shell resolution is sequential
- Item timing rules must be explicit
- Sudden death applies only in Round 3

---

## 11. Sources

- Buckshot Roulette — Wikipedia
- Buckshot Roulette Wiki (Fandom)
