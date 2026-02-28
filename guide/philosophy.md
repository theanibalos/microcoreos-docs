# Philosophy & Principles

MicroCoreOS is not just another framework; it's a paradigm shift in how we build applications in the age of AI.

## The Problem: Context Bloat

Traditional architectures (Clean, Hexagonal, N-Layer) were designed for human brain constraints. They use multiple layers to enforce separation of concerns, which results in:
- **6-8 files** for a single CRUD endpoint.
- **High cognitive load** for both humans and AI.
- **Context Noise**: AI assistants spend tokens reading boilerplate instead of logic.

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
- **Swappable**: You can swap the SQLite `db` tool for a PostgreSQL one without changing a single line of plugin code.

### 🤖 AI-Native Design
The system is built to be "read" by AI agents.
- **AI_CONTEXT.md**: A live manifest generated on boot that tells the AI exactly what tools are available and how to call them.
- **Zero Hallucination**: By reducing the number of files needed to implement a feature, we reduce the surface area for AI errors.

## Core Tenets

| Tenet | Description |
|---|---|
| **Blind Kernel** | The kernel orchestrates but knows nothing of business logic. |
| **Tool = Capability** | Infrastructure lives in Tools. |
| **Plugin = Logic** | Business value lives in Plugins. |
| **Event-Driven** | Plugins communicate via events, never direct imports. |
| **Hybrid Async** | Seamlessly mix synchronous and asynchronous code. |
