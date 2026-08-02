# Testing & Quality Assurance

MicroCoreOS is designed for testability and zero-regression confidence. Since tools are injected via constructors, business logic and kernel core logic can be tested in isolation.

## 1. Everything Is a Black Box

The testing model follows directly from the architecture: **a plugin is a black box under contract**. Nobody reviews its internals — what matters is observable from outside: the route it serves (request in, response out), the events it publishes (exact payload fields), the events it consumes (the keys it reads), and the tables it touches.

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from domains.users.plugins.create_user_plugin import CreateUserPlugin

@pytest.mark.anyio
async def test_create_user_success():
    # 1. Arrange: Mock tools
    mock_db = AsyncMock()
    mock_db.execute.return_value = 1
    
    mock_logger = MagicMock()
    
    # 2. Act: Instantiate plugin directly
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

## 2. Mutation Testing (`mutmut`) — 100% Kernel Blindage

Line coverage can be deceptive. MicroCoreOS uses **Mutation Testing** via `mutmut` to ensure that every conditional statement, operator, and return value in the Kernel core logic is strictly validated by a test assertion.

Run mutation testing:

```bash
uv run -m mutmut run
```

- **Kernel Mutation Score**: **100%** (0 survived mutants in `microcoreos/` core modules).
- **Execution Time**: ~0.4s fast execution loop due to stdlib-only microkernel design.

## 3. Infrastructure Parity Suites — Proven Swaps

Every swappable tool is backed by a **parity suite**. The exact same contract battery runs against in-process references and real infrastructure backends:

| Suite | Validated Swaps |
|---|---|
| `test_db_parity.py` | SQLite ↔ PostgreSQL |
| `test_event_bus_broker_parity.py` | InProcess ↔ SQLite ↔ Redis Streams |
| `test_event_bus_rabbitmq_parity.py` | InProcess ↔ RabbitMQ |
| `test_state_parity.py` | In-Memory Dict ↔ Redis |

## 4. MicroCoreBench — Resilience & Load Laboratory

`MicroCoreBench` is an automated testing suite and web laboratory with 797 tests dedicated to evaluating SUT (System Under Test) applications:

- **Chaos Fault Injection**: Injects paused plugins, 503 Service Unavailable responses, and database error states.
- **Crash Recovery**: Simulates hard process kills (`kill -9`) during event delivery and verifies at-least-once redelivery.
- **Soak Testing (`POST /bench/traffic/soak`)**: Sustained Locust traffic while tracking memory growth with `tracemalloc` to detect memory leaks.
- **Stress-to-Knee Testing (`POST /bench/traffic/stress-to-knee`)**: Automated user ramp-up until `p99` response time or error rate thresholds breach, identifying the system's breaking point.

## 5. CI Pipeline Gates

- **Unit & Integration Matrix**: Python 3.11 / 3.12 / 3.13 against real PostgreSQL 16, Redis 7, RabbitMQ 3.13, and RustFS (S3).
- **AST Architecture Linters**: `GET /system/lint` validates domain isolation, event contracts, table ownership, and route collisions.
- **Strict Warning Safeguards**: `filterwarnings = ["error::pytest.PytestUnhandledThreadExceptionWarning"]` ensures thread exceptions cause immediate test failure.
