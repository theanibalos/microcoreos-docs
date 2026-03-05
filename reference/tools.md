# Tools Reference

Tools provide the infrastructure capabilities of MicroCoreOS. They are injected into Plugins by their name.

## 🛠️ Infrastructure Tools

### `http`
Powered by FastAPI. Handles REST, WebSockets, and Static Files.

- **`add_endpoint(path, method, handler, ...)`**: Registers a REST route.
- **`mount_static(path, directory)`**: Serves a directory.
- **`add_ws_endpoint(path, on_connect, ...)`**: WebSocket support.

### `db`
Unified database interface. Drop-in swappable between SQLite and PostgreSQL.

- **`query(sql, params)`**: Fetch multiple rows.
- **`query_one(sql, params)`**: Fetch a single row.
- **`execute(sql, params)`**: INSERT/UPDATE/DELETE. Supports `$1, $2` placeholders even in SQLite.
- **`transaction()`**: Async context manager for transactions.

### `event_bus`
The nervous system of MicroCoreOS. Decoupled Pub/Sub and RPC.

- **`publish(event, data)`**: Fire-and-forget broadcast.
- **`subscribe(event, callback)`**: Listen for events.
- **`request(event, data)`**: Async RPC (Request/Response).

## 🧰 Utility Tools

### `logger`
Structured logging with support for external sinks.
- `info()`, `error()`, `warning()`.

### `auth`
JWT lifecycle and password hashing.
- `create_token(data)`, `decode_token(token)`.
- `hash_password(pass)`, `verify_password(pass, hash)`.

### `state`
Sharded in-memory key-value store for shared volatility.
- `get(key)`, `set(key, value)`, `increment(key)`.

### `config`
Validated environment variable access for Plugins.
- `get(key)`, `require(*keys)`.

## 🔍 System Tools

### `registry`
Runtime introspection and discovery of the system's full architecture.

- **`get_system_dump()`**: Full inventory of active Tools, Domains, and Plugins.
- **`get_domain_metadata()`**: Detailed analysis of models and schemas per domain.

### `context_manager`
Automatically generates and updates `AI_CONTEXT.md` on every boot.

- Reads the system registry after initialization.
- Exports active tools (with health status and method signatures) and domain models to `AI_CONTEXT.md`.
- Requires no configuration — runs automatically.

### `chaos`
Chaos engineering tool for verifying kernel fault tolerance.

- Intentionally fails during boot when `CHAOS_ENABLED=true` is set in the environment.
- Used to verify that the ToolProxy and graceful degradation mechanisms work correctly.
- Exposes no capabilities to plugins.

---

> [!TIP]
> Always check `AI_CONTEXT.md` for the latest method signatures, as tools are auto-documented at runtime.
