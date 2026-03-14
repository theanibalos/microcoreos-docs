# Quick Comparison

A single-glance reference of how MicroCoreOS behaves differently from traditional layered architectures (Django, NestJS, Spring Boot) across the problems it was designed to solve.

For the full explanation of each problem, see [Problems It Solves](/guide/problems).

---

| Problem                    | Traditional                                                                                          | MicroCoreOS                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Module communication**   | Direct imports between modules. Changing one can silently break others.                              | EventBus only. Domains are physically isolated — cross-domain breakage is impossible.                                 |
| **Architecture over time** | Conventions in a README. Erode under pressure. System decays into a dependency mess within years.    | Explicit structural conventions that are obvious to spot and easy to review. CI linter enforcement coming.            |
| **Merge conflicts**        | Central files (`models.py`, `urls.py`) are touched by everyone. Weekly conflicts in growing teams.   | Each feature is its own file. Nobody shares files. Conflicts are statistically eliminated.                            |
| **AI assistant accuracy**  | AI needs 5–6 files per feature. Makes mistakes with implicit conventions and file placement.         | AI reads `AI_CONTEXT.md` + one plugin. Explicit contract, no design decisions to guess.                               |
| **Dependency failure**     | One failing service (logging, analytics) can cascade and bring down unrelated components.            | ToolProxy contains failures. Failed Tools are marked DEAD; the rest of the system keeps running.                      |
| **Infrastructure change**  | Infrastructure and business logic are entangled. Swapping a database requires touching every module. | Tools are separate from Plugins. SQL-compatible swap = zero plugin changes. Other swaps = isolated per-file rewrites. |
| **Background job errors**  | Errors in async handlers disappear silently. Discovered by customers, not developers.                | Watchdog captures all failures with full causality context. Nothing disappears.                                       |
| **New developer ramp-up**  | Needs to understand the full system before contributing. Takes days to weeks.                        | Reads `AI_CONTEXT.md` + one plugin. Can contribute on day one.                                                        |
| **Sync/async management**  | Developer must manually manage `asyncio`, thread pools, and blocking. Easy to stall the event loop.  | Kernel detects `def` vs `async def` and handles execution. Developer writes normal code.                              |

---

| Metric                               | Traditional | MicroCoreOS |
| ------------------------------------ | ----------- | ----------- |
| Files per feature                    | 5–6         | 1           |
| Time to first commit (new developer) | Days–weeks  | Day one     |
| Cross-domain breakage possible       | Yes         | No          |
| Architecture degrades over time      | Yes         | No          |
| Resilience requires manual code      | Yes         | No          |
