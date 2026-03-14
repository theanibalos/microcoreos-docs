# Tools Reference

Tools are the infrastructure layer of MicroCoreOS. They are singleton instances managed by the Kernel and injected into Plugins by name via their `__init__` parameter names. Plugins never instantiate tools directly — they declare them as constructor dependencies and the DI container resolves them.

::: tip How injection works
The parameter name in `__init__` is the tool name. `def __init__(self, db, http, logger)` receives the `db`, `http`, and `logger` tool instances automatically.
:::

---

## `http` — HTTP Server

Powered by FastAPI. Handles REST endpoints, Server-Sent Events, WebSockets, and static file serving. Routes are buffered during `on_boot()` and registered in the correct order at `on_boot_complete()`.

### `add_endpoint`

```python
http.add_endpoint(
    path: str,
    method: str,
    handler: Callable,
    tags: list[str] | None = None,
    request_model: type[BaseModel] | None = None,
    response_model: type[BaseModel] | None = None,
    auth_validator: Callable | None = None,
)
```

Registers a REST route. The route appears in the auto-generated OpenAPI/Swagger UI.

| Parameter | Type | Description |
|---|---|---|
| `path` | `str` | FastAPI path string, e.g. `"/users/{id}"` |
| `method` | `str` | HTTP verb: `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"` |
| `handler` | `async Callable` | Your `execute` method. Receives `(data: dict, context: HttpContext)` |
| `tags` | `list[str]` | OpenAPI grouping tags shown in Swagger UI |
| `request_model` | `BaseModel` | Pydantic model for request body validation and documentation |
| `response_model` | `BaseModel` | Pydantic model for response documentation |
| `auth_validator` | `async Callable` | Optional auth guard (see below) |

**Handler signature:**

```python
async def execute(self, data: dict, context: HttpContext) -> dict:
    ...
```

`data` is a flat merge of path parameters, query parameters, and the parsed request body. If a POST body has `{"name": "Alice"}` and the path is `/users/{id}`, then `data` will be `{"id": "123", "name": "Alice"}`.

**Auth validator signature:**

```python
async def my_auth(token: str) -> dict | None:
    payload = auth.validate_token(token)
    return payload  # None → 401 Unauthorized
```

The returned payload is injected into `data["_auth"]` so the handler can read the authenticated user's claims. Returning `None` causes an automatic HTTP 401 response with `{"success": false, "error": "Unauthorized"}`.

Token is extracted from `Authorization: Bearer <token>` header OR `access_token` cookie — whichever is present.

**Example:**

```python
async def on_boot(self):
    self.http.add_endpoint(
        "/orders/{order_id}",
        "GET",
        self.execute,
        tags=["Orders"],
        request_model=GetOrderRequest,
        response_model=GetOrderResponse,
        auth_validator=self._auth_guard,
    )

async def _auth_guard(self, token: str) -> dict | None:
    return self.auth.validate_token(token)

async def execute(self, data: dict, context) -> dict:
    user = data["_auth"]       # injected by auth_validator
    order_id = data["order_id"]  # from path params
    ...
```

---

### `add_sse_endpoint`

```python
http.add_sse_endpoint(
    path: str,
    generator: Callable,
    tags: list[str] | None = None,
    auth_validator: Callable | None = None,
)
```

Registers a [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) endpoint. The client receives a persistent stream of newline-delimited `data:` messages.

**Generator signature:**

```python
async def my_generator(data: dict):
    try:
        while True:
            event = await some_queue.get()
            yield f"data: {json.dumps(event)}\n\n"
    finally:
        # cleanup runs here on client disconnect
        pass
```

The generator receives the same `data` dict (path params + query params). Client disconnect is auto-detected by FastAPI — the `finally` block in your generator is guaranteed to run when the client drops the connection.

**Example — live log stream:**

```python
import asyncio, json
from core.base_plugin import BasePlugin

class LogStreamPlugin(BasePlugin):
    def __init__(self, http, logger):
        self.http = http
        self.logger = logger
        self._queues: list[asyncio.Queue] = []

    async def on_boot(self):
        self.logger.add_sink(self._on_log)
        self.http.add_sse_endpoint("/system/logs/stream", self._stream, tags=["System"])

    def _on_log(self, level, message, timestamp, identity):
        record = {"level": level, "message": message, "timestamp": timestamp}
        for q in self._queues:
            q.put_nowait(record)

    async def _stream(self, data: dict):
        q = asyncio.Queue()
        self._queues.append(q)
        try:
            while True:
                record = await q.get()
                yield f"data: {json.dumps(record)}\n\n"
        finally:
            self._queues.remove(q)
```

---

### `add_ws_endpoint`

```python
http.add_ws_endpoint(
    path: str,
    on_connect: Callable,
    on_disconnect: Callable | None = None,
)
```

Registers a WebSocket endpoint. Use SSE for one-directional server push (simpler, more reliable). Use WebSockets when you need bidirectional messaging.

---

### `mount_static`

```python
http.mount_static(path: str, directory_path: str)
```

Serves a local directory as static files under the given URL prefix.

```python
self.http.mount_static("/static", "/app/public")
```

---

### `HttpContext`

Passed as the second argument to every handler. Provides response control without breaking the `dict` return contract.

| Method | Description |
|---|---|
| `context.set_status(code: int)` | Override HTTP response status (default 200 for success, 500 on unhandled exception) |
| `context.set_cookie(key, value, ...)` | Set a response cookie. Accepts all `fastapi.Response.set_cookie` kwargs |
| `context.set_header(key, value)` | Add a custom response header |

```python
async def execute(self, data: dict, context) -> dict:
    token = self.auth.create_token({"sub": user_id})
    context.set_cookie("access_token", token, httponly=True, samesite="lax")
    context.set_status(201)
    return {"success": True, "data": {"id": user_id}}
```

### Response Contract

Every handler must return a JSON-serializable dict with this envelope:

```python
{"success": bool, "data": ..., "error": ...}
```

::: warning Pydantic instances are not JSON-serializable
If you construct a Pydantic model instance inside a handler, call `.model_dump()` on it before returning. FastAPI's response model serialization only applies to the final schema — intermediate values in `data` must be plain dicts.

```python
# Wrong
return {"success": True, "data": MyModel(id=1, name="x")}

# Correct
return {"success": True, "data": MyModel(id=1, name="x").model_dump()}
```
:::

### Configuration

| Variable | Default | Description |
|---|---|---|
| `HTTP_PORT` | `5000` | Port the server listens on |
| `HTTP_HOST` | `127.0.0.1` | Bind address. **Set to `0.0.0.0` in Docker/production** or the server won't accept external connections |
| `HTTP_CORS_ORIGINS` | `*` | Allowed CORS origins. In production, set to your frontend domain(s), comma-separated: `https://app.example.com,https://admin.example.com` |
| `HTTP_LOG_LEVEL` | `warning` | Uvicorn log level. Set to `info` to enable HTTP access logs (method, path, status, latency) |

---

## `db` — Database

Unified async database interface. Uses SQLite by default (zero setup, ideal for development) and PostgreSQL in production. The API is identical — swapping engines requires only an environment variable change.

::: info Placeholder syntax
Always use `$1, $2, $3, ...` PostgreSQL-style placeholders. The SQLite adapter converts them internally. Never use `?`.
:::

### `query`

```python
rows: list[dict] = await db.query(sql: str, params: list = []) -> list[dict]
```

Fetches multiple rows. Returns an empty list if no rows match.

```python
users = await self.db.query(
    "SELECT id, name, email FROM users WHERE active = $1",
    [True]
)
```

### `query_one`

```python
row: dict | None = await db.query_one(sql: str, params: list = []) -> dict | None
```

Fetches a single row. Returns `None` if no row matches. Use for lookups by primary key or unique constraint.

```python
user = await self.db.query_one(
    "SELECT id, name FROM users WHERE email = $1",
    [email]
)
if user is None:
    return {"success": False, "error": "User not found"}
```

### `execute`

```python
result: int | None = await db.execute(sql: str, params: list = []) -> int | None
```

Executes INSERT, UPDATE, DELETE, or DDL statements.

| Statement type | Return value |
|---|---|
| `INSERT ... RETURNING id` | Value of the first column in RETURNING |
| `INSERT` (no RETURNING) | `lastrowid` of the inserted row |
| `UPDATE` / `DELETE` | Number of affected rows |

```python
# Get inserted ID via RETURNING
user_id = await self.db.execute(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
    [name, email]
)

# Get affected rows
deleted = await self.db.execute(
    "DELETE FROM sessions WHERE expires_at < $1",
    [now]
)
```

### `execute_many`

```python
await db.execute_many(sql: str, params_list: list[list]) -> None
```

Executes a statement multiple times with different parameter sets. Efficient for bulk inserts.

```python
await self.db.execute_many(
    "INSERT INTO tags (post_id, name) VALUES ($1, $2)",
    [[post_id, tag] for tag in tags]
)
```

### `transaction`

```python
async with db.transaction() as tx:
    await tx.execute(...)
    await tx.query(...)
```

Async context manager. Commits on clean exit, rolls back on any exception. The `tx` object exposes `query()`, `query_one()`, and `execute()` with the same signatures as `db`.

```python
async with self.db.transaction() as tx:
    user_id = await tx.execute(
        "INSERT INTO users (name) VALUES ($1) RETURNING id", [name]
    )
    await tx.execute(
        "INSERT INTO profiles (user_id) VALUES ($1)", [user_id]
    )
    # Both inserted, or neither — atomically
```

### `health_check`

```python
ok: bool = await db.health_check() -> bool
```

Runs a lightweight ping query against the database. Returns `True` if the connection is healthy. Used by health-check plugins to update `registry` status proactively.

### Errors

`db` raises `DatabaseError` on query failure and `DatabaseConnectionError` on connectivity failure. Both inherit from a common base so you can catch either specifically or together.

```python
from tools.database.exceptions import DatabaseError, DatabaseConnectionError

try:
    await self.db.execute("INSERT ...", [])
except DatabaseConnectionError:
    return {"success": False, "error": "Database unavailable"}
except DatabaseError as e:
    return {"success": False, "error": str(e)}
```

---

## `event_bus` — Event Bus

The nervous system of MicroCoreOS. Enables decoupled pub/sub messaging and async RPC between plugins without direct imports.

### `publish`

```python
await event_bus.publish(event_name: str, data: dict) -> None
```

Fire-and-forget broadcast. All subscribers are called concurrently. Returns immediately without waiting for subscribers to finish.

```python
await self.event_bus.publish("user.registered", {"user_id": user_id, "email": email})
```

### `subscribe`

```python
await event_bus.subscribe(event_name: str, callback: Callable) -> None
```

Register a callback for an event. Use `*` as the event name to receive every event (wildcard subscribers are observability-only — they cannot reply in `request()` RPC).

**Subscriber signature:**

```python
async def on_user_registered(self, data: dict) -> None:
    # data is the payload published by the emitter
    await self.mailer.send_welcome(data["email"])
```

::: warning Subscriber callback signature
The callback receives only `data: dict`. There is no `event_name` second argument.
:::

### `unsubscribe`

```python
await event_bus.unsubscribe(event_name: str, callback: Callable) -> None
```

Removes a previously registered subscription.

### `request`

```python
response: dict = await event_bus.request(
    event_name: str,
    data: dict,
    timeout: float = 5.0,
) -> dict
```

Synchronous-style RPC over the event bus. Blocks until a subscriber returns a non-`None` dict, or raises `TimeoutError` after `timeout` seconds. Exactly one subscriber should handle each RPC event.

```python
# Caller (e.g. OrderPlugin)
pricing = await self.event_bus.request(
    "pricing.calculate",
    {"product_id": 42, "quantity": 3},
    timeout=2.0,
)
total = pricing["total"]
```

```python
# Handler (PricingPlugin)
async def on_boot(self):
    await self.event_bus.subscribe("pricing.calculate", self.on_calculate)

async def on_calculate(self, data: dict) -> dict:
    price = data["quantity"] * self._unit_price(data["product_id"])
    return {"total": price}  # non-None dict → RPC response
```

### `get_trace_history`

```python
records: list[dict] = event_bus.get_trace_history() -> list[dict]
```

Returns the last 500 event trace records. Each record includes causality data (parent event ID) allowing you to reconstruct causal chains. Used internally by the system traces API.

### `get_subscribers`

```python
subscriber_map: dict = event_bus.get_subscribers() -> dict
```

Returns the current subscriber map: `{event_name: [subscriber_names]}`. Useful for debugging and topology visualization.

### `add_listener`

```python
event_bus.add_listener(callback: Callable) -> None
```

Registers a sink that is called on every event, regardless of event name. Unlike subscribers, listeners cannot reply in RPC and must not block (they are called synchronously in the dispatch loop — keep them fast).

**Listener signature:**

```python
def my_listener(record: dict) -> None:
    # record fields:
    # - id: str           unique event ID
    # - event: str        event name
    # - emitter: str      plugin/tool that published
    # - subscribers: list subscriber names called
    # - payload_keys: list keys present in data (not values, for privacy)
    # - timestamp: str    ISO 8601
    pass
```

---

## `auth` — Authentication

JWT lifecycle management and password hashing. Backed by PyJWT and passlib/bcrypt.

### `hash_password`

```python
hashed: str = auth.hash_password(password: str) -> str
```

Bcrypt-hashes a plaintext password. Store the result; never store the plaintext.

### `verify_password`

```python
ok: bool = auth.verify_password(password: str, hashed: str) -> bool
```

Verifies a plaintext password against a bcrypt hash. Constant-time comparison.

### `create_token`

```python
token: str = auth.create_token(data: dict, expires_delta: int | None = None) -> str
```

Creates a signed JWT. `data` becomes the token payload. `expires_delta` is in seconds; if omitted, the default expiry from configuration is used.

```python
token = self.auth.create_token(
    {"sub": str(user_id), "role": user["role"]},
    expires_delta=3600,  # 1 hour
)
```

### `decode_token`

```python
payload: dict = auth.decode_token(token: str) -> dict
```

Decodes and verifies a JWT. Raises an exception if the token is expired or has an invalid signature. Use in contexts where you want explicit error handling.

### `validate_token`

```python
payload: dict | None = auth.validate_token(token: str) -> dict | None
```

Safe, non-throwing variant of `decode_token`. Returns the payload dict on success, `None` on any failure (expired, invalid, malformed). Ideal for `auth_validator` callbacks in `add_endpoint`.

```python
async def _require_admin(self, token: str) -> dict | None:
    payload = self.auth.validate_token(token)
    if payload is None:
        return None
    if payload.get("role") != "admin":
        return None  # also 401 — role check failed
    return payload
```

---

## `logger` — Structured Logger

Provides structured log output with level filtering and an extensible sink system.

### Methods

```python
logger.info(message: str)
logger.warning(message: str)
logger.error(message: str)
```

### `add_sink`

```python
logger.add_sink(callback: Callable) -> None
```

Attaches an external sink that receives every log record. Use this to forward logs to a queue, external service, or SSE stream.

**Sink signature:**

```python
def my_sink(level: str, message: str, timestamp: str, identity: str) -> None:
    # level: "INFO" | "WARNING" | "ERROR"
    # timestamp: ISO 8601 string
    # identity: name of the plugin or tool that called the logger
    forward_to_queue(level, message)
```

::: warning Sinks must not block
Sinks are called synchronously inside the logger. Do not perform I/O or `await` inside a sink. Use `queue.put_nowait()` and process the queue from an async consumer.
:::

---

## `state` — In-Memory State

A sharded, namespace-scoped in-memory key-value store. State is lost on restart — use `db` for persistence. Useful for counters, rate limiting buckets, cached computed values, and cross-plugin signaling within a single process.

### Methods

```python
state.set(key: str, value: Any, namespace: str = 'default') -> None
state.get(key: str, default: Any = None, namespace: str = 'default') -> Any
state.increment(key: str, amount: int = 1, namespace: str = 'default') -> int
state.delete(key: str, namespace: str = 'default') -> None
```

**Example — rate limiting:**

```python
async def execute(self, data: dict, context) -> dict:
    user_id = data["_auth"]["sub"]
    count = self.state.increment(f"ratelimit:{user_id}", namespace="api")
    if count > 100:
        context.set_status(429)
        return {"success": False, "error": "Rate limit exceeded"}
    ...
```

---

## `config` — Configuration

Validated environment variable access for Plugins. Tools read environment variables directly via `os.getenv()` — `config` is the plugin-facing abstraction.

### `get`

```python
value: str | None = config.get(key: str, default: Any = None, required: bool = False) -> str | None
```

Reads an environment variable. If `required=True` and the variable is not set, raises `EnvironmentError` immediately. Use `required=True` for variables that are mandatory for the plugin to function.

```python
stripe_key = self.config.get("STRIPE_SECRET_KEY", required=True)
```

### `require`

```python
config.require(*keys: str) -> None
```

Fail-fast validation for multiple required variables. Call in `on_boot()` so missing configuration is detected immediately at startup rather than at runtime.

```python
async def on_boot(self):
    self.config.require("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "FRONTEND_URL")
    # If any are missing, boot fails here with a clear error message
```

---

## `registry` — Runtime Registry

Runtime introspection, health status, and performance metrics for the entire system.

### `get_system_dump`

```python
dump: dict = registry.get_system_dump() -> dict
```

Returns a full inventory of the running system:

```python
{
  "tools": {
    "db": {"status": "OK", "message": None},
    "http": {"status": "OK", "message": None},
  },
  "plugins": {
    "CreateUserPlugin": {
      "status": "OK",
      "error": None,
      "domain": "users",
      "class": "CreateUserPlugin",
      "dependencies": ["db", "http", "logger"],
    }
  },
  "domains": {
    "users": {"plugin_count": 3, ...}
  }
}
```

Tool status is `REACTIVE` — it is updated automatically when `ToolProxy` catches an exception. If a tool call raises, the tool's status is set to `"DEAD"` automatically.

### `get_domain_metadata`

```python
meta: dict = registry.get_domain_metadata() -> dict
```

Returns per-domain metadata including model field introspection.

### `get_metrics`

```python
records: list[dict] = registry.get_metrics() -> list[dict]
```

Returns the last 1000 tool call performance records from the ring buffer:

```python
{
  "tool": "db",
  "method": "query",
  "duration_ms": 3.4,
  "success": True,
  "timestamp": "2026-03-14T10:22:31Z"
}
```

### `add_metrics_sink`

```python
registry.add_metrics_sink(callback: Callable) -> None
```

Attaches a real-time sink called synchronously after every tool call. Keep the callback fast — it runs in the hot path.

**Sink signature:**

```python
def on_metric(record: dict) -> None:
    # record: {tool, method, duration_ms, success, timestamp}
    if record["duration_ms"] > 500:
        alert_slow_query(record)
```

### `update_tool_status`

```python
registry.update_tool_status(name: str, status: str, message: str | None = None) -> None
```

Manually overrides a tool's health status. Valid values: `"OK"`, `"FAIL"`, `"DEAD"`. Use in health-check plugins to proactively report status rather than waiting for an exception.

```python
ok = await self.db.health_check()
self.registry.update_tool_status("db", "OK" if ok else "DEAD", message="periodic check")
```

---

## `telemetry` — OpenTelemetry

Distributed tracing via OpenTelemetry. **Disabled by default.** Zero changes to plugins or tools when enabled — instrumentation is applied automatically at the `ToolProxy` level.

### Activation

```bash
# Install dependencies
uv add opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation-fastapi

# Enable via environment
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-service          # default: "microcoreos"
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces  # omit for console output
```

### How it works

When `OTEL_ENABLED=true`, `TelemetryTool` registers a `span_factory` in the `Container`. `ToolProxy` wraps every tool call in a span automatically — no tool or plugin code changes. `HttpServerTool` implements `on_instrument()` to call `FastAPIInstrumentor`, adding HTTP route, status code, and latency to the root span.

### `get_tracer`

```python
tracer = telemetry.get_tracer(scope: str) -> Tracer
```

Returns a named `opentelemetry.trace.Tracer` for creating custom spans within a plugin. Returns a no-op tracer if telemetry is disabled, so your plugin code is identical regardless of OTEL state.

```python
class ProcessOrderPlugin(BasePlugin):
    def __init__(self, db, http, logger, telemetry):
        self.telemetry = telemetry

    async def execute(self, data: dict, context) -> dict:
        tracer = self.telemetry.get_tracer("orders")
        with tracer.start_as_current_span("validate-inventory") as span:
            span.set_attribute("order.id", data["order_id"])
            result = await self._check_inventory(data)
        return result
```

### BSP Tuning

For high-throughput services, tune the Batch Span Processor via environment variables:

| Variable | Default | Description |
|---|---|---|
| `OTEL_BSP_SCHEDULE_DELAY` | `5000` | Export interval in milliseconds |
| `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | `512` | Spans per export batch |
| `OTEL_BSP_MAX_QUEUE_SIZE` | `2048` | Max spans queued before dropping |

### Export targets

Any OTLP-compatible backend works:
- **Jaeger**: `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces`
- **Grafana Tempo**: `OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318/v1/traces`
- **Datadog**: Use the Datadog OTLP ingest endpoint
- **Console**: Omit `OTEL_EXPORTER_OTLP_ENDPOINT` entirely — spans print to stdout

---

## `scheduler` — Background Jobs

Schedules recurring and one-shot background jobs using APScheduler. Zero infrastructure required — runs directly in the asyncio event loop. Supports both async and sync callbacks transparently.

### Methods

```python
scheduler.add_job(cron_expr, callback, job_id=None)  → str
scheduler.add_one_shot(run_at, callback, job_id=None) → str
scheduler.remove_job(job_id)                          → bool
scheduler.list_jobs()                                 → list[dict]
```

### `add_job` — recurring cron job

```python
# Every 5 minutes
scheduler.add_job("*/5 * * * *", self.flush_cache)

# Weekdays at 09:00, with a stable ID to prevent duplicates on restart
scheduler.add_job("0 9 * * 1-5", self.send_digest, job_id="morning_digest")
```

Standard 5-field cron syntax: `minute hour day month weekday`.

| Expression | Meaning |
|---|---|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 9 * * 1-5` | Weekdays at 09:00 |
| `0 0 * * *` | Midnight every day |
| `0 0 1 * *` | Midnight on the 1st of each month |

### `add_one_shot` — one-time job

```python
from datetime import datetime, timedelta, timezone

run_at = datetime.now(timezone.utc) + timedelta(hours=1)
scheduler.add_one_shot(run_at, self.send_welcome_email)
```

### Usage in a Plugin

Register jobs in `on_boot()`. The scheduler starts after all plugins have booted, so no job fires prematurely.

```python
from datetime import datetime, timedelta, timezone
from core.base_plugin import BasePlugin

class MaintenancePlugin(BasePlugin):
    def __init__(self, scheduler, db, logger):
        self.scheduler = scheduler
        self.db = db
        self.logger = logger

    async def on_boot(self):
        # Delete expired sessions every night at 03:00
        self.scheduler.add_job("0 3 * * *", self.cleanup_sessions, job_id="cleanup")

    async def cleanup_sessions(self):
        deleted = await self.db.execute(
            "DELETE FROM sessions WHERE expires_at < NOW()"
        )
        self.logger.info(f"Cleaned up {deleted} expired sessions")
```

### Inspecting jobs

```python
jobs = scheduler.list_jobs()
# [{"id": "cleanup", "next_run": "2026-03-15 03:00:00+00:00", "trigger": "cron[...]"}]
```

### Swap standard

Replace with Celery Beat or any other scheduler by creating a new tool with `name = "scheduler"` implementing the same 4 methods. Plugins do not change.

---

## `context_manager` — AI Context Generator

Auto-generates `AI_CONTEXT.md` on every boot by scanning the registry and domain models. The file contains the live tool inventory with health status, method signatures, and all domain entity schemas.

No plugin API. No configuration required. The file is always up to date.

---

## `chaos` — Chaos Engineering

Intentionally fails during boot when `CHAOS_ENABLED=true`. Used to verify that `ToolProxy` graceful degradation and registry fault reporting work correctly.

No plugin API. Never enable in production.

---

> [!TIP]
> `AI_CONTEXT.md` in the project root is regenerated on every boot and always reflects the current tool method signatures. When in doubt, read it — it is the authoritative live reference.
