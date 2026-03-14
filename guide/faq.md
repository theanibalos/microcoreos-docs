# FAQ

---

## Why not use an ORM?

ORMs solve the syntax problem — your queries look the same whether you're on SQLite or PostgreSQL. What they don't solve is the coupling problem: your models are defined *in terms of the ORM*, with decorators, relationships, and dialect-specific types baked in. The model itself becomes the coupling.

MicroCoreOS uses raw SQL through the `db` tool, which accepts PostgreSQL-style `$1, $2` placeholders and converts them transparently for SQLite. Each plugin owns its queries inline. When a plugin is a single file with 50 lines of logic, you don't need the abstraction layer — the code is already simple enough to read and modify directly.

If you switch databases, an AI can rewrite the affected plugins in seconds. The cost of that rewrite is lower than the ongoing cost of working around ORM limitations.

---

## When should I NOT use MicroCoreOS?

**Systems with microsecond latency requirements** — real-time games, high-frequency trading, or anything where the overhead of an event loop, async dispatch, and a Python runtime is a hard constraint. MicroCoreOS is fast, but it's not a low-latency engine.

**MicroCoreOS is a strong fit for most applications**, including solo developers. A single developer with AI agents can be highly effective — you can put multiple agents to work in parallel, each in its own plugin file, with significantly reduced coordination overhead.

**Legacy systems** are not a blocker — they're an opportunity. The approach is to migrate feature by feature: keep the existing system running and start extracting functionality into plugins one story at a time. You don't need to rewrite everything to start benefiting from the architecture.

For large projects, the pattern is to break the work into user stories and delivery tiers, let AI handle the implementation of each plugin, and ship incrementally. The architecture is specifically designed for this workflow.

---

## Is this a framework or a pattern?

Both, in that order.

It's a **framework** — it gives you all the infrastructure you need to build: an HTTP server, database access, an event bus, auth, logging, dependency injection, and a kernel that wires it all together. You can clone the repo and ship a production API without installing anything else.

It's also based on a philosophy called **Atomic Microkernel Architecture** — a set of principles about how software should be structured when AI is part of the development team. One file per feature. Infrastructure separate from logic. Rules explicit enough to spot in review, with tooling enforcement on the roadmap. Context always available and complete.

The framework embodies the philosophy. You can apply the philosophy to other stacks, but the framework makes it the path of least resistance.

---

## How is this different from just using FastAPI?

If your team isn't losing context between sessions, isn't stepping on each other's work, and isn't spending time correcting AI-generated code — you don't have a reason to switch. FastAPI is excellent.

The difference shows up at scale and with AI-assisted development. When you ask an AI to add a feature in a standard FastAPI project, it needs to read the router, the service, the schema, the model, and possibly the dependency injection setup. It makes assumptions about conventions. It puts things in the wrong place. You correct it.

In MicroCoreOS, the AI reads `AI_CONTEXT.md` and the plugin file. The contract is explicit enough that there are no placement decisions to make — only logic to write. This significantly reduces the back-and-forth required to implement new features.

---

## Can I use any Python library?

Yes, with two things to keep in mind.

**Every library you add has weight.** Be deliberate about dependencies. A library that does one thing well is better than a large framework pulled in for a single utility function.

**If a library will be used across multiple plugins, wrap it in a Tool.** This keeps the library's initialization and configuration in one place, makes it injectable by name, and means the AI knows it exists via `AI_CONTEXT.md`. If you import a library directly in several plugins, you've created implicit coupling between those plugins and that library's API — exactly the kind of scattered dependency the architecture is designed to avoid.

If a library is used in exactly one plugin and nowhere else, importing it directly in that file is fine.
