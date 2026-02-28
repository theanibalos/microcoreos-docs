# Creating Plugins

Plugins are the building blocks of your application. Each plugin should focus on a single, atomic feature.

## Plugin Structure

A plugin lives in `domains/{domain_name}/plugins/` and inherits from `BasePlugin`.

```python
from pydantic import BaseModel
from core.base_plugin import BasePlugin

# 1. Define Request/Response Schemas (Inline)
class CreateProductRequest(BaseModel):
    name: str
    price: float

class CreateProductPlugin(BasePlugin):
    # 2. Declare Dependencies
    def __init__(self, db, http, logger, event_bus):
        self.db = db
        self.http = http
        self.logger = logger
        self.bus = event_bus

    # 3. Register Hook
    async def on_boot(self):
        self.http.add_endpoint(
            path="/products",
            method="POST",
            handler=self.execute,
            request_model=CreateProductRequest
        )

    # 4. Implement Logic
    async def execute(self, data: dict, context=None):
        req = CreateProductRequest(**data)
        # ... logic ...
        return {"success": True, "data": {"id": 123}}
```

## Best Practices

### 1. Zero Direct Imports
Never import from another domain. Use the `event_bus` for cross-domain communication.

### 2. Inline Schemas
Keep your request and response models at the top of the plugin file. This makes the feature completely self-contained and "AI-readable".

### 3. Error Handling
Always return the standard format: `{"success": bool, "data": ..., "error": ...}`.

### 4. Hybrid Execution
- Use `async def` for I/O bound tasks (DB calls, HTTP requests).
- Use `def` for CPU bound tasks (image processing, heavy math). The Kernel will automatically run synchronous methods in a thread pool to avoid blocking the main loop.
