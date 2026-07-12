# Testing

MicroCoreOS is designed for testability. Since dependencies are injected via constructors, you can test business logic without booting the entire system.

## Everything Is a Black Box

The testing model follows directly from the architecture: **a plugin is a black box under contract**. Nobody reviews its internals — what matters is observable from outside: the route it serves (request in, response out), the events it publishes (exact payload fields), the events it consumes (the keys it reads), and the tables it touches. The unit test proves *that contract*, not the implementation.

The same rule scales up: **a flow is a bigger box**. A chain like `POST /orders → order.created → OrderNotifierPlugin → order.notified` is a closed system with its own input and output, tested exactly the same way — what goes in, what comes out — with the causal trace verifying the path in between. This is what makes AI-written code trustworthy: the AI fills the box; the contract keeps it honest. See [Parallel Development](/development/parallel-development) for how contracts are reserved at plan time.

## Unit Testing Plugins

We recommend using `pytest` and `anyio` for testing plugins. Since plugins are just classes, you can instantiate them with mocks of the tools they need.

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from domains.users.plugins.create_user_plugin import CreateUserPlugin

@pytest.mark.anyio
async def test_create_user_success():
    # 1. Arrange: Mock the tools
    mock_db = AsyncMock()
    mock_db.execute.return_value = 1  # Simulated ID
    
    mock_logger = MagicMock()
    
    # 2. Act: Instantiate the plugin manually
    plugin = CreateUserPlugin(
        db=mock_db,
        http=MagicMock(),
        event_bus=AsyncMock(),
        logger=mock_logger
    )
    
    result = await plugin.execute({"name": "John Doe", "email": "john@example.com"})
    
    # 3. Assert
    assert result["success"] is True
    assert result["data"]["id"] == 1
    mock_db.execute.assert_called_once()
```

## Integration Testing

To test how multiple plugins and tools interact, you can use the `Kernel` in your tests to boot a mini-system.

```python
from core.kernel import Kernel

async def test_system_integration():
    kernel = Kernel()
    await kernel.boot()
    
    # Access the container to get specific tools or plugins
    db = kernel.container.get('db')
    
    # ... perform actions and verify state ...
    
    await kernel.shutdown()
```

## End-to-End Chain Tests

Event-driven flows are asserted against the **real causal tree**, not by inspecting internals. Every event carries a `parent_id`, so the whole chain is reconstructable — the helper `tests/helpers/trace_chains.py` turns a flow assertion into a one-liner:

```python
from tests.helpers.trace_chains import build_tree, assert_chain

tree = build_tree(bus.get_trace_history())
assert_chain(tree, ["order.created", "order.notified"])
```

Sad paths use the same helper, because `_dlq.<event>` is published *inside* the failing delivery's context and appears as a child of the event that failed:

```python
assert_chain(tree, ["order.created", "_dlq.order.created"])
```

## Idempotency Tests

Distributed transports deliver **at least once** — after a crash, a handler may run twice. Any consumer with `retries > 0` or in a durable flow must prove idempotency: deliver the same envelope twice (same mocks as the unit test, still milliseconds) and assert the final state and side effects are those of a single delivery. Redelivery itself is proven once, generically, by the transport's kill-and-reboot suite (`tests/tools/test_sqlite_driver.py`) — no feature ever writes a kill test.

## Parity Suites — Swaps Are Proven, Not Assumed

Every swappable tool is backed by a **parity suite**: the same contract battery runs against the in-process reference and against the real infrastructure, so a replacement is proven equivalent before it ships:

| Suite | Proves |
|---|---|
| `tests/tools/test_state_parity.py` | In-memory dict ↔ real Redis |
| `tests/tools/test_event_bus_broker_parity.py` | In-process ↔ SQLite ↔ Redis Streams (parametrized over all built-in transports) |
| `tests/tools/test_event_bus_rabbitmq_parity.py` | Bus contract against real RabbitMQ |

## CI — The Hard Gate

Boot-time linters are advisory (they warn, never block). The **hard gate is CI**, which runs against real infrastructure:

- **Test matrix**: Python 3.11 / 3.12 / 3.13, with real **PostgreSQL 16**, **Redis 7**, **RabbitMQ 3.13** and an S3-compatible store (RustFS) as services — the parity suites run against actual backends instead of skipping themselves.
- **Lint**: `ruff check .` plus core-compilation smoke imports.
- **Smoke boot**: a second job boots the REAL system against real infrastructure and asserts via `GET /system/status` that **every tool is `OK` and every plugin is `READY`** — a tool can only prove it is alive if its backend is actually mounted.
- **Lint gate**: the same job queries `GET /system/lint` and fails the pipeline on any architecture violation, tool drift, or event-contract warning. Advisory at runtime, mandatory in CI.

Docs-only changes (`**.md`, `LICENSE`) skip the pipeline entirely.

## Best Practices

- **Mock the Database**: Use `AsyncMock` to simulate database responses. This keeps tests fast and deterministic.
- **Trace Identity**: When testing event-driven flows, verify that the `ContextVars` (e.g., identity, causality) are preserved.
- **1 Feature = 1 Test File**: Just like the architecture, keep your tests focused on the feature they are validating.
- **Test the contract, not the internals**: assert output, DB effects on declared tables, and published payloads — never private methods.
