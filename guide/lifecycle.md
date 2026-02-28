# Lifecycle & Dependency Injection

Understanding how MicroCoreOS boots and wires dependencies is key to mastering the architecture.

## 🚀 The Boot Sequence

The Kernel manages a strict lifecycle to ensure all resources are ready before the first request arrives.

1.  **Tool Setup**:
    - Every Tool's `setup()` method is called.
    - This is where tools allocate resources (DB connections, HTTP server instances).
2.  **Plugin Initialization (DI phase)**:
    - Plugins are discovered in `domains/*/plugins/`.
    - The Kernel inspects the `__init__` signature of each plugin.
    - It resolves and injects the requested Tools by name.
3.  **Plugin Boot**:
    - Every Plugin's `on_boot()` is called.
    - Plugins register their interest: endpoints with `http`, subscriptions with `event_bus`.
4.  **Boot Completion**:
    - Tools receive `on_boot_complete(container)`. This allows tools to interact with other tools now that everything is wired.
5.  **System Online**:
    - The HTTP server starts, and the system begins processing events.

## 💉 Dependency Injection

DI in MicroCoreOS is **declarative** and **name-based**.

```python
class MyPlugin(BasePlugin):
    def __init__(self, db, auth, logger): # I want these tools
        self.db = db
        self.auth = auth
        self.logger = logger
```

- **Transparent**: No complex configuration or decorators. Just name the tool in your constructor.
- **Kernel-Managed**: The container handles the singleton lifecycle of tools and delivers them to your plugins.

## 🧪 Testing with DI

Because dependencies are passed via the constructor, testing a plugin in isolation is trivial using mocks:

```python
from unittest.mock import AsyncMock, MagicMock

async def test_my_plugin():
    # 1. Prepare mocks
    mock_db = AsyncMock()
    
    # 2. Instantiate plugin with mocks (no kernel needed)
    plugin = MyPlugin(db=mock_db, auth=MagicMock(), logger=MagicMock())
    
    # 3. Call and Assert
    await plugin.execute({"id": 1})
    mock_db.query_one.assert_called_once()
```
