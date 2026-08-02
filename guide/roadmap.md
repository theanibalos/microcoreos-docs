# Roadmap

What's delivered and what's coming next to MicroCoreOS.

---

## Delivered Milestones

### Distribution & CLI Packaging (v0.3.0+)

- ✅ **PyPI Package (`microcoreos`)** — Install via `pip install microcoreos` or `uv add microcoreos`.
- ✅ **Scaffolding CLI** — `microcoreos new my_app` provisions a complete project with initial migrations and domain structure.
- ✅ **Plan Inspector & Status** — `microcoreos status` and `microcoreos plan validate` for offline validation.

### Kernel Quality & Mutation Blindage

- ✅ **100% Mutation Score** — `microcoreos/` core kernel logic has 0 survived mutants under `mutmut`.
- ✅ **83%+ Tool Test Coverage** — Complete unit suites covering `TelemetryTool` (100%), `RegistryTool` (100%), `StateTool` (99%), `EventBusTool` (96%), `ContextTool` (92%), and `HttpPipeline` (85%).

### Official Swappable Infrastructure Tools

- ✅ `microcoreos[postgres]` — Drop-in PostgreSQL Tool replacing SQLite with schema parity.
- ✅ `microcoreos[redis]` — Redis Tool for state caching and Redis Streams event bus.
- ✅ `microcoreos[kafka]` & `microcoreos[rabbitmq]` — Enterprise message brokers verified by 13 canonical parity tests.
- ✅ `microcoreos[auth]` — Pre-built JWT & Session Auth Tool with Anti-CSRF protection (`X-Requested-With`).

### Architecture Linters & Governance

- ✅ **Domain Isolation Linter** — Prevents cross-domain imports at build/CI time.
- ✅ **Event Contract Linter** — Validates event publisher/subscriber payload compatibility.
- ✅ **Table Ownership Linter** — Enforces single-domain table write ownership.
- ✅ **Route Collision Linter** — Prevents duplicate HTTP route registrations.

### MicroCoreBench Resilience & Load Testing Laboratory

- ✅ **Stand-Alone Bench Suite** — 797 tests covering chaos injection, fault simulation, and crash recovery (`kill -9`).
- ✅ **Soak Testing** — Sustained traffic load monitoring memory leaks via `tracemalloc`.
- ✅ **Stress-to-Knee Testing** — Automated user ramp-up finding the exact breaking point where `p99` latency or error rates breach thresholds.

---

## Future Roadmap

### EventBus & Outbox

- **Distributed Tracing Spans** — Exporting OpenTelemetry trace context across gRPC and external HTTP service boundaries.
- **Event Schema Registry** — Central schema registry for event payload deprecations.

### Platform

- **WASM Plugin Runtime** — Polyglot capabilities to execute WebAssembly plugins alongside Python plugins.
