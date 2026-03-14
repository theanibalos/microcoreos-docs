# Philosophy & Principles

MicroCoreOS is not just another framework; it's a paradigm shift in how we build applications in the age of AI.

## The Problems We're Solving

Traditional architectures accumulate problems over time that no amount of discipline or documentation can fully prevent. MicroCoreOS was designed to minimize them at the structural level:

- **Invisible coupling** — a change in one module silently breaks another.
- **Architectural decay** — shortcuts taken under time pressure erode design over months.
- **Merge conflicts** — shared central files create constant friction in growing teams.
- **Fragmented AI context** — 5–6 files needed for a single feature means AI makes mistakes.
- **Cascading failures** — one broken dependency takes down the whole system.
- **Costly infrastructure changes** — swapping a database requires touching all business logic.
- **Silent async errors** — background jobs fail without leaving a trace.
- **Slow onboarding** — new developers need weeks to understand unwritten conventions.
- **Uncontrolled sync/async mixing** — event loop bugs are non-deterministic and hard to find.

→ See [Problems It Solves](/guide/problems) for a deep dive into each.

## The Solution: Atomic Microkernel

MicroCoreOS follows the **"1 File = 1 Feature"** principle.

### 🧩 Atomic Plugins
A plugin is a self-contained unit of business logic. It defines its own:
1. **Request Schema**: Inline Pydantic models.
2. **Registration**: How it hooks into the system (HTTP, Events).
3. **Execution**: The actual logic.

By keeping everything in one file, we minimize "Context Saturation". An AI only needs to read the Tool signatures (`AI_CONTEXT.md`) and the Plugin file to understand or modify a feature.

### ⚛️ Decoupled Tools
Tools are pure infrastructure. They are:
- **Stateless**: They provide capabilities (DB, HTTP, Logic) but don't hold domain state.
- **Swappable**: You can swap compatible infrastructure (like swapping the SQLite `db` tool for a PostgreSQL one) without changing plugin code.

### 🤖 AI-Native Design
The system is built to be "read" by AI agents.
- **AI_CONTEXT.md**: A live manifest generated on boot that tells the AI exactly what tools are available and how to call them.
- **Fewer AI errors**: By reducing the number of files needed to implement a feature, the surface area for incorrect assumptions shrinks significantly.

## Core Tenets

| Tenet | Description |
|---|---|
| **Blind Kernel** | The kernel orchestrates but knows nothing of business logic. |
| **Tool = Capability** | Infrastructure lives in Tools. |
| **Plugin = Logic** | Business value lives in Plugins. |
| **Event-Driven** | Plugins communicate via events, never direct imports. |
| **Hybrid Async** | Seamlessly mix synchronous and asynchronous code. |
