# Problems MicroCoreOS Solves

MicroCoreOS was designed around 9 concrete problems that plague teams building production software. Each architectural decision maps directly to one or more of them.

---

## 1 — Invisible Coupling (The Butterfly Effect)

In layered frameworks, modules import each other directly. Over time this creates an invisible web: change a method in `Users`, unknowingly break `Billing`, which breaks `Reports`. In large codebases this becomes real fear — developers stop refactoring bad code because touching anything might break something unrelated.

**How MicroCoreOS solves it:** Cross-domain imports are forbidden by convention and verified by the `ArchitectureLinterPlugin` on every boot. Communication happens through the EventBus with explicit contracts, and the `EventContractLinterPlugin` statically checks that every key a consumer requires is present in every publish site (`GET /system/lint`).

> The blast radius of any change is a single file — and the linters verify it on every boot.

---

## 2 — Architectural Decay Over Time

Every project starts with good intentions. Six months in, a developer under pressure takes a shortcut: direct import "just this once", logic dumped in a controller. Each shortcut seems harmless. Collectively they destroy the architecture. Two years in, the original team is gone and the new one doesn't understand why things are the way they are. This is *architectural decay* — why companies rewrite systems every 3–5 years.

**How MicroCoreOS solves it:** The rules are explicit conventions with a clear structural rationale — not arbitrary style preferences. A Plugin only receives Tools via its constructor. Domains don't import each other. And the rules are enforced by machines, not willpower: boot-time linters report every violation at `GET /system/lint`, and CI is the hard gate — the pipeline fails on any architecture violation, tool drift, or event-contract warning.

> The architecture resists degradation because the conventions are explicit and mechanically enforced — a shortcut can't survive CI.

---

## 3 — Merge Conflicts and Lost Productivity

In Django or Spring Boot, there are files everyone touches: `models.py`, `urls.py`, `app.module.ts`. Three people editing the same file in the same sprint is normal. Merge conflicts are weekly. Resolving them wrong introduces silent bugs. In large teams this is a constant drain — hours per week, slower reviews, delayed deploys.

**How MicroCoreOS solves it:** Each feature is its own file. One developer works on `products_plugin.py`, another on `users_plugin.py`. There are no shared files to edit: migrations and models are written first, in the foundation phase, and become read-only references while features are built — nobody co-edits them. Shared namespaces (routes, events, tables) are reserved in the plan before any code exists, so a collision is caught at plan time, never at merge time. See [Parallel Development](/development/parallel-development) for the full methodology.

> Merge conflicts are rare because each feature lives in its own file, radically reducing the surface area for shared edits.

---

## 4 — Fragmented Context for AI

When an AI agent needs to add an endpoint in Django, it reads `models.py` + `serializers.py` + `views.py` + `urls.py` + `services.py` — 5–6 files for one feature. Context is fragmented, conventions are implicit, and the AI puts logic in the wrong place. The developer corrects the output, partially negating the benefit of using AI at all.

**How MicroCoreOS solves it:** The kernel auto-generates `AI_CONTEXT.md` — a live manifest with every tool's exact method signatures. The AI reads that file plus the single plugin file. Design decisions are made beforehand, in the [plan](/development/parallel-development) — routes, events, payloads, failure handling — by a human or an AI. By the time code is written the contract is already fixed: there are no design decisions left to take, only logic to fill in.

> AI produces cleaner code because the context is smaller and the pattern is explicit, significantly reducing the back-and-forth compared to layered architectures.

---

## 5 — Runtime Errors That Crash the Entire System

When a dependency fails — the database goes down, the log server times out — there are two common outcomes: the system throws an unhandled exception and crashes, or the error propagates silently. Teams compensate with thousands of lines of defensive code: try/catch everywhere, manual circuit breakers, homegrown health checks.

**How MicroCoreOS solves it:** Failures are isolated and made visible — never hidden. `ToolProxy` wraps every infrastructure call: a tool that declares its backend unreachable is marked `DEAD` immediately; anything else after 5 consecutive failures. A `DEAD` tool never takes down the process — plugins fail individually, the rest of the system boots and serves, and the full health picture is one query away at `GET /system/status`.

What the kernel deliberately does **not** do is retry or swallow errors ([Honest Kernel](/reference/kernel-internals)): a blind retry at the kernel level can duplicate a non-idempotent operation — a double payment. Resilience lives where the knowledge is: infrastructure retries in the Tool (e.g. SQLite lock retries), business decisions in the Plugin.

> The system never hides a failure and never dies from one. Fault *isolation* is automatic; fault *handling* is explicit — exactly where your data integrity needs it to be.

---

## 6 — Infrastructure Changes Are Expensive

In Django or NestJS, infrastructure and business logic are entangled. Adding Redis for caching or switching to a different database means touching every module that accesses it — models, serializers, connection management, tests. It's a multi-week project before a single line of business logic changes.

**How MicroCoreOS solves it:** Tools are separate from Plugins. A Plugin declares it needs `"db"`. Swapping between compatible SQL databases (like SQLite to PostgreSQL) requires zero plugin changes because both use the same `$1, $2` placeholder syntax.

Switching to a fundamentally different system (e.g. a NoSQL store) does require updating each plugin's queries — but since each feature is a single isolated file, an AI can regenerate them in minutes. The cost of infrastructure migrations drops from weeks of archaeology to a fast AI-assisted rewrite.

> The blast radius of an infrastructure change is always known and contained.

---

## 7 — Silent Async Errors

In systems with background jobs or event handlers, errors disappear. The request finished, the response was sent, and the background process died quietly. Teams discover these failures when a customer reports their email never arrived, or when a billing process has been silently stopped for three days.

**How MicroCoreOS solves it:** The EventBus has a Watchdog that captures all handler failures with full context. The causality engine maintains the complete chain: which request emitted which event, which handler failed, and why.

> Async errors have the same visibility as synchronous ones. Debugging is a query, not forensic archaeology.

---

## 8 — Slow Developer Onboarding

Joining a project with a layered architecture means learning the full structure before contributing: conventions, where code goes, how modules connect, what unwritten rules exist. In large projects this takes weeks. The new developer introduces errors not from incompetence but from missing context.

**How MicroCoreOS solves it:** Read `AI_CONTEXT.md` (5 minutes) and one existing plugin (10 minutes). The pattern is so explicit and consistent that the system teaches itself. There are no implicit conventions to learn because the rules are in the code.

> A new developer can understand the pattern in minutes and begin contributing on their first day.

---

## 9 — Chaotic Sync/Async Mixing

Most systems mix synchronous code (legacy libraries, CPU-bound work) with async code (IO, HTTP, databases). Managing this correctly requires deep knowledge of the event loop. Developers without that experience introduce blocking calls that stall all concurrent requests, or create non-deterministic race conditions — the hardest class of bugs to reproduce and debug.

**How MicroCoreOS solves it:** The Kernel detects whether a Plugin method is `def` or `async def` and executes it correctly. Sync methods run in a thread pool via `asyncio.to_thread` automatically. The developer writes normal code.

> Use any synchronous library without thinking about the event loop. The Kernel manages concurrency transparently.

---

## Summary

| Problem | Mechanism |
|---|---|
| Invisible coupling | Domain isolation + EventBus contracts, verified by boot linters |
| Architectural decay | Explicit structural conventions + linters + CI hard gate |
| Merge conflicts | 1 file = 1 feature; namespaces reserved at plan time |
| Fragmented AI context | Auto-generated `AI_CONTEXT.md` + design fixed in the plan |
| Runtime cascading failures | ToolProxy fault isolation + Honest Kernel (no silent retries) |
| Costly infrastructure changes | Swappable Tools for compatible backends |
| Silent async errors | Watchdog + causality engine |
| Slow onboarding | Explicit pattern + self-documenting system |
| Sync/async chaos | Kernel auto-threads sync methods |
