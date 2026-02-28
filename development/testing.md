# Testing

MicroCoreOS is designed for testability. Since dependencies are injected via constructors, you can test business logic without booting the entire system.

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

## Best Practices

- **Mock the Database**: Use `AsyncMock` to simulate database responses. This keeps tests fast and deterministic.
- **Trace Identity**: When testing event-driven flows, verify that the `ContextVars` (e.g., identity, causality) are preserved.
- **1 Feature = 1 Test File**: Just like the architecture, keep your tests focused on the feature they are validating.
