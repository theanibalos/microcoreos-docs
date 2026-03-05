# AI-Native Design

MicroCoreOS is engineered specifically to maximize the productivity of AI coding assistants like Claude, Cursor, and GitHub Copilot.

## The Problem with Traditional Codebases
AI agents often struggle with:
- **Context Saturation**: Reading too many files just to understand how to add one field.
- **Hallucinations**: Guessing method signatures of internal tools.
- **Boilerplate**: Getting lost in the ceremony of DI configuration and routing.

## The MicroCoreOS Solution

### 🤖 Live AI Manifest (`AI_CONTEXT.md`)
The system includes a `context_manager` tool that auto-generates a system-wide manifest every time the kernel boots.

- **Exact signatures**: The manifest contains the exact method signatures, health status, and purpose of every available Tool — no need to guess or infer.
- **Up-to-Date**: As you add new tools, the manifest updates itself.
- **Instructional**: It includes brief usage examples for each capability.

### 🧩 Atomic Files (1 File = 1 Feature)
By keeping the schema, registration, and logic in a single file, the knowledge footprint of a feature is minimal. An AI reading one plugin file has everything needed to understand and modify that feature — no jumping between layers.

### ⚡ Lowest Token Consumption
We have measured the token cost of common tasks. MicroCoreOS consistently requires **3x to 5x fewer tokens** to implement the same feature compared to traditional N-Layer architectures.

| Task | Trad. Tokens | MicroCoreOS Tokens |
|---|---|---|
| Add CRUD Endpoint | ~4,000 | ~1,000 |
| Add Background Task | ~2,500 | ~600 |
| Mocking a Tool | ~1,500 | ~300 |

## How to use it with AI Agents

When prompting an AI to work on MicroCoreOS, simply point it to the manifest:

> "Read `AI_CONTEXT.md` to see available tools. Create a new plugin in the `orders` domain that..."

The AI will correctly identify the `db` tool, use the `$1, $2` placeholder syntax, and register the endpoint via `http` without you ever having to explain how the framework works.
