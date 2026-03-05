# Roadmap

What's coming to MicroCoreOS.

---

## Planned Features

### Distribution

- **GitHub template repository** — Start a new project with one click, batteries included.
- **Core as a pip package** — `uv add microcoreos` to install the kernel as a dependency.
- **Professional CLI with src-layout** — Ready for PyPI distribution standards.

### Official Tool Packages

Separate, installable packages for common infrastructure:

- `microcoreos-postgres` — Drop-in PostgreSQL Tool replacing the default SQLite.
- `microcoreos-redis` — Redis Tool for caching and pub/sub.
- `microcoreos-auth` — Pre-built JWT and OAuth Tool.

### Developer Tooling

- **Domain isolation linter** — Detects cross-domain imports in CI before they reach production.
- **Event contract linter** — Validates that event emitters and subscribers have compatible schemas.

### EventBus Enhancements

- **Distributed tracing across services** — The EventBus already tracks causality within a single process. This extends that trace propagation to multi-service deployments (separate processes, separate machines).
- **Event versioning** — Handle schema evolution of events without breaking existing subscribers.

### Platform

- **WASM support** — Polyglot capabilities to run non-Python plugins.

---

> This roadmap reflects the current direction. Priorities may shift based on community feedback and real-world usage.
