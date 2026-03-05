# Creating Plugins

Plugins are the building blocks of your application. Each plugin should focus on a single, atomic feature.

## Plugin Structure

A plugin lives in `domains/{domain_name}/plugins/` and inherits from `BasePlugin`.

```python
from typing import Optional
from pydantic import BaseModel
from core.base_plugin import BasePlugin

# 1. Request schema — lives here, not in models/
class CreateProductRequest(BaseModel):
    name: str
    price: float

# 2. Response schema — define only the fields you actually return
class ProductData(BaseModel):
    id: int
    name: str
    price: float

class CreateProductResponse(BaseModel):
    success: bool
    data: Optional[ProductData] = None
    error: Optional[str] = None

class CreateProductPlugin(BasePlugin):
    # 3. Declare dependencies by name
    def __init__(self, db, http, logger, event_bus):
        self.db = db
        self.http = http
        self.logger = logger
        self.bus = event_bus

    # 4. Register endpoints and subscriptions
    async def on_boot(self):
        self.http.add_endpoint(
            path="/products",
            method="POST",
            handler=self.execute,
            tags=["Products"],
            request_model=CreateProductRequest,
            response_model=CreateProductResponse,
        )

    # 5. Implement logic
    async def execute(self, data: dict, context=None):
        try:
            req = CreateProductRequest(**data)
            product_id = await self.db.execute(
                "INSERT INTO products (name, price) VALUES ($1, $2) RETURNING id",
                [req.name, req.price]
            )
            await self.bus.publish("product.created", {"id": product_id})
            return {"success": True, "data": {"id": product_id, "name": req.name, "price": req.price}}
        except Exception as e:
            self.logger.error(f"Failed to create product: {e}")
            return {"success": False, "error": str(e)}
```

## Schemas

**Request schema** — validates and documents the input. Always define it inline at the top of the plugin file.

**Response schema** — documents the output shape for OpenAPI. Define only the fields you actually return. Never expose sensitive entity fields like `password_hash`. Pass it to `response_model=` in `add_endpoint` so the Swagger UI shows correct types.

If a plugin only subscribes to events and has no HTTP endpoint, schemas are optional.

## Best Practices

### 1. Zero Direct Imports
Never import from another domain. Use the `event_bus` for cross-domain communication.

### 2. Schemas in the Plugin File
Request and response models live at the top of the plugin, not in `models/`. `models/` is only for DB entity classes that mirror a table.

### 3. Standard Response Format
Always return `{"success": bool, "data": ..., "error": ...}`. Use `context.set_status(N)` to override the HTTP status code.

### 4. Hybrid Execution
- `async def` for I/O (DB queries, HTTP calls, event publishing).
- `def` for CPU-bound work (image processing, heavy computation). The Kernel automatically runs sync methods in a thread pool — never call `time.sleep()` or blocking IO inside an async method.
