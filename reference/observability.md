# Observability

MicroCoreOS has three built-in observability layers. The first two are always on with zero configuration. The third is optional and requires one environment variable to activate.

| Layer | What it tracks | Configuration |
|---|---|---|
| **Causal Event Tracing** | Every event published on the bus, with parent causality | Always on |
| **Tool Call Metrics** | Duration and success of every tool call | Always on |
| **OpenTelemetry** | Distributed traces exported to Jaeger, Tempo, Datadog, etc. | `OTEL_ENABLED=true` |

---

## Layer 1 — Causal Event Tracing

Every event published on the `event_bus` is recorded in a ring buffer with causality metadata. If Event B was published inside a subscriber that was triggered by Event A, Event B's `parent_id` points to Event A's `id`. This forms a causal tree — you can reconstruct exactly why something happened, not just what happened.

### How causality is tracked

The event bus automatically propagates a `_causality_id` through the async context. When a subscriber publishes a new event, the bus detects the current causality context and sets `parent_id` accordingly. No plugin code is needed — it is entirely automatic.

### Built-in system endpoints

The system domain exposes a set of trace and topology endpoints out of the box.

#### `GET /system/traces/flat`

Returns the last 500 event records in chronological order.

```json
[
  {
    "id": "evt_01J2X...",
    "parent_id": null,
    "event": "user.registered",
    "emitter": "CreateUserPlugin",
    "subscribers": ["WelcomeEmailPlugin", "AuditLogPlugin"],
    "payload_keys": ["user_id", "email"],
    "timestamp": "2026-03-14T10:22:31.004Z"
  },
  {
    "id": "evt_01J2Y...",
    "parent_id": "evt_01J2X...",
    "event": "email.send_requested",
    "emitter": "WelcomeEmailPlugin",
    "subscribers": ["SmtpDispatchPlugin"],
    "payload_keys": ["to", "template", "context"],
    "timestamp": "2026-03-14T10:22:31.019Z"
  }
]
```

::: info Payload keys, not values
The `payload_keys` field lists which keys were present in the event payload, but not their values. This prevents sensitive data (tokens, passwords, PII) from being exposed in the trace log.
:::

#### `GET /system/traces/tree`

Returns the same data as `/flat` but structured as a hierarchical tree where each event lists its causal children. Useful for rendering causal diagrams.

```json
[
  {
    "id": "evt_01J2X...",
    "event": "user.registered",
    "children": [
      {
        "id": "evt_01J2Y...",
        "event": "email.send_requested",
        "children": [
          { "id": "evt_01J2Z...", "event": "email.sent", "children": [] }
        ]
      },
      {
        "id": "evt_01J2W...",
        "event": "audit.entry_created",
        "children": []
      }
    ]
  }
]
```

#### `GET /system/traces/stream`

Live SSE stream of event records. On connection, the client receives a snapshot of the current trace history (same as `/flat`), then receives each new event in real time as it occurs.

```
data: {"snapshot": true, "records": [...]}

data: {"id": "evt_01J2Z...", "event": "order.created", ...}

data: {"id": "evt_01J2AA...", "event": "inventory.reserved", ...}
```

Connect with any SSE client:

```javascript
const stream = new EventSource("/system/traces/stream");
stream.onmessage = (e) => {
  const record = JSON.parse(e.data);
  renderTrace(record);
};
```

#### `GET /system/events`

Event topology report: which plugins emit which events, who subscribes, and how many times each event has fired since boot. Also performs a static scan of source files to surface events that are defined in code but have not fired yet (useful for catching dead code and untested paths).

```json
{
  "topology": {
    "user.registered": {
      "emitters": ["CreateUserPlugin"],
      "subscribers": ["WelcomeEmailPlugin", "AuditLogPlugin"],
      "fire_count": 142
    },
    "order.created": {
      "emitters": ["CreateOrderPlugin"],
      "subscribers": ["InventoryPlugin", "NotificationPlugin"],
      "fire_count": 0,
      "note": "found in source but never fired"
    }
  }
}
```

#### `GET /system/logs/stream`

Live log stream via SSE. Every call to `logger.info()`, `logger.warning()`, or `logger.error()` is pushed to all connected clients in real time.

```
data: {"level": "INFO", "message": "User 42 logged in", "timestamp": "...", "identity": "LoginPlugin"}

data: {"level": "ERROR", "message": "DB query failed: ...", "timestamp": "...", "identity": "db"}
```

#### `GET /system/status`

Snapshot of tool and plugin health from the registry.

```json
{
  "tools": {
    "db": { "status": "OK", "message": null },
    "http": { "status": "OK", "message": null },
    "event_bus": { "status": "OK", "message": null }
  },
  "plugins": {
    "CreateUserPlugin": { "status": "OK", "domain": "users" },
    "PaymentPlugin": { "status": "DEAD", "error": "Connection refused" }
  }
}
```

### Building your own trace consumer

Use `event_bus.add_listener()` to attach a custom sink that receives every event record:

```python
class TraceForwarderPlugin(BasePlugin):
    def __init__(self, event_bus, logger):
        self.event_bus = event_bus
        self.logger = logger

    async def on_boot(self):
        self.event_bus.add_listener(self._on_trace)

    def _on_trace(self, record: dict) -> None:
        # record: {id, event, emitter, subscribers, payload_keys, timestamp, parent_id}
        # Must not block — runs synchronously in the dispatch loop
        self._forward_to_external_system(record)
```

---

## Layer 2 — Tool Call Metrics

`ToolProxy` wraps every tool call and measures its duration. This is automatic — it applies to `db`, `http`, `event_bus`, `auth`, and every other tool. You get latency and success/failure data for every infrastructure operation without instrumenting anything.

### The ring buffer

Metrics are stored in a ring buffer of 1000 records. When the buffer is full, the oldest record is evicted. Each record has:

```python
{
  "tool": "db",
  "method": "query",
  "duration_ms": 3.4,
  "success": True,
  "timestamp": "2026-03-14T10:22:31Z"
}
```

### Reading metrics from a plugin

```python
class SystemMetricsPlugin(BasePlugin):
    def __init__(self, http, registry):
        self.http = http
        self.registry = registry

    async def on_boot(self):
        self.http.add_endpoint("/system/metrics", "GET", self.execute, tags=["System"])

    async def execute(self, data: dict, context) -> dict:
        records = self.registry.get_metrics()

        # Compute per-tool stats
        from collections import defaultdict
        stats = defaultdict(lambda: {"calls": 0, "errors": 0, "total_ms": 0.0})
        for r in records:
            key = f"{r['tool']}.{r['method']}"
            stats[key]["calls"] += 1
            stats[key]["total_ms"] += r["duration_ms"]
            if not r["success"]:
                stats[key]["errors"] += 1

        summary = {
            k: {
                "calls": v["calls"],
                "errors": v["errors"],
                "avg_ms": round(v["total_ms"] / v["calls"], 2) if v["calls"] else 0,
            }
            for k, v in stats.items()
        }
        return {"success": True, "data": summary}
```

### Real-time metrics sink

For real-time alerting or streaming, attach a sink with `registry.add_metrics_sink()`. The callback runs synchronously in the tool call hot path — keep it fast (microseconds, not milliseconds):

```python
import asyncio

class SlowQueryMonitorPlugin(BasePlugin):
    def __init__(self, registry, logger):
        self.registry = registry
        self.logger = logger
        self._alert_threshold_ms = 300.0

    async def on_boot(self):
        self.registry.add_metrics_sink(self._on_metric)

    def _on_metric(self, record: dict) -> None:
        if not record["success"]:
            self.logger.error(
                f"Tool call failed: {record['tool']}.{record['method']}"
            )
        elif record["duration_ms"] > self._alert_threshold_ms:
            self.logger.warning(
                f"Slow call: {record['tool']}.{record['method']} "
                f"took {record['duration_ms']:.1f}ms"
            )
```

::: warning Sink execution context
The metrics sink is called synchronously from the `ToolProxy` after each tool call. Do not `await` inside the sink, do not call other tools, and do not perform I/O. If you need to do async work in response to a metric, put the record into an `asyncio.Queue` and consume it from an async loop.
:::

### Proactive Health Checks

By default, tool health status in the registry is updated reactively — only when a tool call raises an exception. For critical infrastructure like the database, you may want proactive periodic checks.

```python
import asyncio
from core.base_plugin import BasePlugin


class DbHealthPlugin(BasePlugin):
    def __init__(self, db, registry, logger):
        self.db = db
        self.registry = registry
        self.logger = logger
        self._task: asyncio.Task | None = None

    async def on_boot(self):
        interval = int(self.config.get("HEALTH_CHECK_INTERVAL", default="30"))
        self._task = asyncio.create_task(self._run(interval))

    async def _run(self, interval: int):
        while True:
            try:
                ok = await self.db.health_check()
                status = "OK" if ok else "DEAD"
                self.registry.update_tool_status("db", status, message="periodic check")
                if not ok:
                    self.logger.error("DB health check failed")
            except Exception as e:
                self.registry.update_tool_status("db", "DEAD", message=str(e))
                self.logger.error(f"DB health check exception: {e}")
            await asyncio.sleep(interval)

    async def shutdown(self):
        if self._task:
            self._task.cancel()
```

Set `HEALTH_CHECK_INTERVAL` (in seconds, default 30) to control the polling frequency. Extend this pattern for any tool that exposes a health check method.

---

## Layer 3 — OpenTelemetry

OpenTelemetry provides distributed tracing: spans that cross service boundaries, export to external backends, and integrate with APM dashboards. It is entirely optional and zero-configuration from the plugin perspective — no plugin or tool imports `opentelemetry` directly.

### How it works

```
Request arrives at FastAPI
  └── HttpServerTool.on_instrument() calls FastAPIInstrumentor
        → creates root HTTP span (route, status code, latency)
            └── ToolProxy wraps each tool call in a child span
                  └── Custom spans via telemetry.get_tracer() nest inside
```

When `OTEL_ENABLED=true`, `TelemetryTool` registers a `span_factory` in the `Container`. `ToolProxy` consults this factory before every tool call and wraps the call in a span. This means `db.query()`, `event_bus.publish()`, `auth.validate_token()`, and all other tool calls appear as child spans under the root HTTP span — automatically, without touching any plugin or tool code.

### Activation

```bash
# 1. Install dependencies
uv add opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation-fastapi

# 2. Set environment variables
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-service                              # default: microcoreos
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces  # omit for console output
```

With just these two steps, every tool call is traced. No changes to plugins.

### Custom spans in plugins

When you need finer-grained spans inside a single handler — for example, to distinguish between the "validate" phase and the "commit" phase of a complex operation — use `telemetry.get_tracer()`:

```python
class ProcessOrderPlugin(BasePlugin):
    def __init__(self, db, http, event_bus, telemetry):
        self.db = db
        self.http = http
        self.event_bus = event_bus
        self.telemetry = telemetry

    async def execute(self, data: dict, context) -> dict:
        tracer = self.telemetry.get_tracer("orders.process")

        # Validation span
        with tracer.start_as_current_span("validate-inventory") as span:
            span.set_attribute("order.id", data["order_id"])
            span.set_attribute("order.quantity", data["quantity"])
            available = await self._check_inventory(data["product_id"], data["quantity"])
            if not available:
                span.set_attribute("validation.result", "insufficient_stock")
                context.set_status(409)
                return {"success": False, "error": "Insufficient stock"}

        # Commit span
        with tracer.start_as_current_span("create-order-record") as span:
            order_id = await self.db.execute(
                "INSERT INTO orders (product_id, quantity, user_id) "
                "VALUES ($1, $2, $3) RETURNING id",
                [data["product_id"], data["quantity"], data["_auth"]["sub"]],
            )
            span.set_attribute("order.created_id", order_id)

        await self.event_bus.publish("order.created", {"order_id": order_id})
        return {"success": True, "data": {"order_id": order_id}}
```

::: tip No-op when disabled
`telemetry.get_tracer()` returns an OpenTelemetry no-op tracer when `OTEL_ENABLED` is not set. The `with tracer.start_as_current_span(...)` blocks execute normally and produce zero overhead. Your plugin code is identical regardless of whether tracing is active.
:::

### Export targets

| Backend | `OTEL_EXPORTER_OTLP_ENDPOINT` |
|---|---|
| Jaeger | `http://jaeger:4318/v1/traces` |
| Grafana Tempo | `http://tempo:4318/v1/traces` |
| Datadog Agent | `http://datadog-agent:4318/v1/traces` |
| Honeycomb | `https://api.honeycomb.io/v1/traces` (with `OTEL_EXPORTER_OTLP_HEADERS`) |
| Console (dev) | Omit `OTEL_EXPORTER_OTLP_ENDPOINT` entirely |

All OTLP-compatible backends work. For backends that require authentication headers:

```bash
OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=your-api-key,x-honeycomb-dataset=your-dataset"
```

### BSP tuning

The Batch Span Processor (BSP) controls how spans are batched before export. The defaults are conservative — tune for your throughput:

| Variable | Default | Description |
|---|---|---|
| `OTEL_BSP_SCHEDULE_DELAY` | `5000` | Milliseconds between export batches |
| `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | `512` | Maximum spans per export request |
| `OTEL_BSP_MAX_QUEUE_SIZE` | `2048` | Maximum spans queued; oldest dropped when full |

For high-throughput production services:

```bash
OTEL_BSP_SCHEDULE_DELAY=1000
OTEL_BSP_MAX_EXPORT_BATCH_SIZE=256
OTEL_BSP_MAX_QUEUE_SIZE=4096
```

For development with console exporter (see spans immediately):

```bash
OTEL_BSP_SCHEDULE_DELAY=500
OTEL_BSP_MAX_EXPORT_BATCH_SIZE=1
```

---

## Built-in System Plugins

MicroCoreOS ships with a set of system plugins in `domains/system/plugins/` that provide observability out of the box. They are regular plugins — discoverable, replaceable, and deletable without affecting anything else. In production you may remove them if the endpoints are not needed, or keep them behind a network boundary.

### `ToolHealthPlugin` — Proactive health checks

The framework already includes a ready-to-use health check plugin. You do not need to write the `DbHealthPlugin` pattern shown above — it is already there.

`ToolHealthPlugin` runs a background loop that calls `db.health_check()` every `N` seconds and updates the registry status. If the check fails, the tool is marked `FAIL` or `DEAD` and a warning is logged. If a previously failing tool recovers, its status is automatically reset to `OK`.

**Configuration:**

```bash
HEALTH_CHECK_INTERVAL=30   # seconds between checks (default: 30)
```

**What it checks:** Currently checks `db`. Extend the pattern to any tool that exposes a `health_check() → bool` method.

::: tip Auto-recovery in ToolProxy
In addition to the proactive health check, `ToolProxy` also auto-recovers silently: if a tool is marked `DEAD` due to a previous exception and its next call succeeds, the status is automatically reset to `OK` with the message `"Recovered from transient failure"`. The health check and the proxy recovery work together — the proxy recovers on the first successful call, the health check recovers proactively on a timer.
:::

### `EventDeliveryMonitorPlugin` — Dead-letter tracking

Hooks into the EventBus failure mechanism. When a subscriber raises an exception while handling an event, the EventBus calls all registered failure listeners synchronously. `EventDeliveryMonitorPlugin` receives these notifications and publishes `event.delivery.failed` onto the bus so the failure is visible in:

- The live log stream (`/system/logs/stream`) — as an `ERROR` entry
- The event trace (`/system/traces/*`) — as a node in the causal tree
- The event stream (`/system/events/stream`) — in real time

**The published event:**

```python
{
    "event":      "user.created",          # the original event that failed
    "event_id":   "evt_01J2X...",          # the original event ID
    "subscriber": "WelcomeEmailPlugin",    # which subscriber raised
    "error":      "SMTP connection refused" # the exception message
}
```

Subscribe to `event.delivery.failed` in any plugin to build custom dead-letter handling:

```python
class DeadLetterPlugin(BasePlugin):
    def __init__(self, event_bus, db, logger):
        self.bus = event_bus
        self.db = db
        self.logger = logger

    async def on_boot(self):
        await self.bus.subscribe("event.delivery.failed", self.on_failed)

    async def on_failed(self, data: dict) -> None:
        # Persist to DB for retry or manual review
        await self.db.execute(
            "INSERT INTO dead_letters (event, subscriber, error) VALUES ($1, $2, $3)",
            [data["event"], data["subscriber"], data["error"]],
        )
```

::: warning Recursion guard
If a subscriber that listens to `event.delivery.failed` itself fails, the monitor detects that the failing event is `event.delivery.failed` and stops — it does not publish again. This prevents an infinite loop.
:::

### System endpoints

All endpoints below are provided by plugins in `domains/system/plugins/` and are active by default.

| Endpoint | Description |
|---|---|
| `GET /system/status` | Snapshot of all tool and plugin health from the registry |
| `GET /system/events` | Event topology: who emits what, who subscribes, fire counts |
| `GET /system/traces/flat` | Last 500 events in chronological order |
| `GET /system/traces/tree` | Same data as causal parent→child tree |
| `GET /system/traces/stream` | Live SSE stream of events (snapshot on connect, then real-time) |
| `GET /system/logs/stream` | Live SSE stream of all logger calls |
| `GET /system/events/stream` | Live SSE stream of all bus events |

::: warning These endpoints are not authenticated by default
They are designed for internal use (local network, admin dashboard, developer tooling). In production, either remove the plugins or place them behind a network boundary (VPN, internal load balancer). Do not expose them on a public-facing host without adding an `auth_validator`.
:::

---

## Combining All Three Layers

The observability layers compose naturally. A typical production setup might:

1. Use causal event traces to understand the behavioral flow of each request
2. Use tool call metrics to detect slow database queries and set SLA alerts
3. Export OTel spans to Grafana Tempo, correlating with logs via trace ID

```python
class ObservabilityAggregatorPlugin(BasePlugin):
    """Single plugin wiring all three layers to external sinks."""

    def __init__(self, http, registry, event_bus, logger):
        self.http = http
        self.registry = registry
        self.event_bus = event_bus
        self.logger = logger

    async def on_boot(self):
        # Layer 1: causal event trace sink
        self.event_bus.add_listener(self._on_event)

        # Layer 2: tool call metrics sink
        self.registry.add_metrics_sink(self._on_metric)

        # Layer 2: log sink
        self.logger.add_sink(self._on_log)

        # Expose combined status endpoint
        self.http.add_endpoint("/system/status", "GET", self.status, tags=["System"])

    def _on_event(self, record: dict) -> None:
        # Forward to external event store
        pass

    def _on_metric(self, record: dict) -> None:
        # Alert on slow calls or failures
        if not record["success"]:
            self.logger.error(f"Tool failure: {record['tool']}.{record['method']}")

    def _on_log(self, level, message, timestamp, identity) -> None:
        # Forward logs to external log aggregator
        pass

    async def status(self, data: dict, context) -> dict:
        dump = self.registry.get_system_dump()
        metrics = self.registry.get_metrics()
        return {
            "success": True,
            "data": {
                "health": dump,
                "recent_metrics": metrics[-10:],
            },
        }
```
