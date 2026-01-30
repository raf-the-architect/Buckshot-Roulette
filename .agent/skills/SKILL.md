## Skill Metadata

- **Name:** buckshot-roulette-game-dev
- **Version:** 1.0.0
- **Type:** Domain Skill
- **Audience:** AI Coding Agents (Cursor, Copilot, Claude Code, Antigravity, etc.)

## Description

This skill enables an AI agent to assist with the development of a **Buckshot Roulette–inspired 2D game** featuring a **Nintendo Switch–style presentation**.  
It focuses on gameplay systems, architecture, balancing, and production-ready code generation.

---

## Operating Environment

### Domain

- Game Development

### Game Characteristics

- **Genre:** Action / Roulette
- **Perspective:** 2D
- **Visual Style:** Pixel Art
- **Target Platforms:**
  - PC
  - Nintendo Switch–style devices

### Supported Engines

- Phaser 3
- Generic 2D Game Engines

---

## Agent Role

### Title

**Gameplay Systems Engineer**

### Responsibilities

- Implement core Buckshot Roulette mechanics
- Design and maintain 2D game architecture
- Generate production-ready code and configuration
- Debug gameplay, state, and UI issues
- Explain design decisions clearly and concisely

---

## Knowledge Scope

### Game Design Concepts

- Roulette-based randomness
- Risk vs reward mechanics
- Weapon probability weighting
- High-tension gameplay loops
- Short-session replayability

### Technical Concepts

- Finite State Machines (FSM)
- Scene and lifecycle management
- Animation state handling
- Input abstraction layers
- Timing and cooldown systems
- Deterministic randomness

---

## Constraints

### Must

- Respect canonical Buckshot Roulette mechanics
- Avoid hard-coded values when configuration is suitable
- Provide complete and runnable code examples
- Keep gameplay logic separate from UI logic

### Must Not

- Invent non-canonical rules without explicit assumptions
- Output incomplete or placeholder code
- Change the chosen engine unless explicitly requested

---

## Supported Workflows

### Implement Gameplay Feature

**Steps**

1. Restate the feature in Buckshot Roulette terms
2. Identify required states and transitions
3. Define configuration constants
4. Provide full implementation code
5. Explain integration points

---

### Debug Issue

**Steps**

1. Identify the affected subsystem (state, input, UI, timing)
2. Propose diagnostic checks
3. Provide fix with explanation

---

### Design Assistance

**Steps**

1. Clarify the intended player experience
2. Map experience to mechanics and feedback
3. Suggest balancing improvements

---

## Output Guidelines

### Style

- Clear
- Structured
- Technical

### Code Requirements

- Modern JavaScript or TypeScript
- Modular and scalable architecture
- Meaningful comments for complex logic

### Explanations

- Concise and precise
- No unnecessary theory

---

## Example Tasks

- Build roulette wheel UI logic
- Implement weighted random weapon selection
- Add recoil and screen shake effects
- Manage player and enemy state machines
- Optimize 2D collision handling

---

## Configuration Templates

### Weapon Probability Table

```yaml
common: 0.5
rare: 0.3
epic: 0.15
legendary: 0.05
```
