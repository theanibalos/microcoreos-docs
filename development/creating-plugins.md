# Creating Plugins

Plugins are the primary unit of work in MicroCoreOS. Each plugin file implements exactly one feature: one endpoint, one event handler, one background job. This constraint keeps files small, focused, and independently testable.

A plugin lives in `domains/{domain}/plugins/` and inherits from `BasePlugin`. The Kernel discovers it automatically — no registration required.

---

## Plugin Anatomy

A complete plugin has three parts: a request schema, a response schema, and the plugin class itself.

```python
from typing import Optional
from pydantic import BaseModel, Field
from core.base_plugin import BasePlugin


# --- 1. Request schema ---
class CreateProductRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200, description="Product display name")
    price: float = Field(gt=0, description="Unit price in USD")
    sku: str = Field(pattern=r"^[A-Z0-9\-]{3,20}$", description="Stock keeping unit")
    description: Optional[str] = Field(default=None, max_length=2000)


# --- 2. Response schemas ---
class ProductData(BaseModel):
    id: int
    name: str
    price: float
    sku: str


class CreateProductResponse(BaseModel):
    success: bool
    data: Optional[ProductData] = None
    error: Optional[str] = None


# --- 3. Plugin class ---
class CreateProductPlugin(BasePlugin):
    def __init__(self, db, http, logger, event_bus):
        self.db = db
        self.http = http
        self.logger = logger
        self.event_bus = event_bus

    async def on_boot(self):
        self.http.add_endpoint(
            "/products",
            "POST",
            self.execute,
            tags=["Products"],
            request_model=CreateProductRequest,
            response_model=CreateProductResponse,
        )

    async def execute(self, data: dict, context=None) -> dict:
        try:
            req = CreateProductRequest(**data)
            product_id = await self.db.execute(
                "INSERT INTO products (name, price, sku, description) "
                "VALUES ($1, $2, $3, $4) RETURNING id",
                [req.name, req.price, req.sku, req.description],
            )
            await self.event_bus.publish("product.created", {
                "id": product_id,
                "sku": req.sku,
            })
            return {
                "success": True,
                "data": {"id": product_id, "name": req.name, "price": req.price, "sku": req.sku},
            }
        except Exception as e:
            self.logger.error(f"Failed to create product: {e}")
            return {"success": False, "error": str(e)}
```

---

## Request Schema Validation

**All request schema fields must use `pydantic.Field` with explicit constraints.** Never declare bare `str`, `int`, or `float` fields. Field constraints serve as both validation rules and OpenAPI documentation.

```python
from pydantic import BaseModel, Field
from typing import Optional

class CreateUserRequest(BaseModel):
    # String fields: always declare min_length to prevent empty strings
    username: str = Field(min_length=3, max_length=50, description="Unique username")
    email: str = Field(min_length=5, max_length=255, description="User email address")

    # Numeric fields: always declare bounds
    age: int = Field(gt=0, le=150, description="User age in years")
    credit_limit: float = Field(ge=0.0, le=1_000_000.0, description="Credit limit in USD")

    # Pattern-validated strings
    phone: str = Field(pattern=r"^\+?[1-9]\d{7,14}$", description="E.164 phone number")
    slug: str = Field(pattern=r"^[a-z0-9\-]+$", min_length=3, max_length=100)

    # Optional fields with explicit defaults
    bio: Optional[str] = Field(default=None, max_length=500)
    role: str = Field(default="user", pattern=r"^(user|moderator|admin)$")
```

::: warning Never use bare type annotations in request schemas
```python
# Wrong — no validation, no documentation
class BadRequest(BaseModel):
    name: str
    age: int
    price: float

# Correct — explicit constraints on every field
class GoodRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    age: int = Field(gt=0, le=150)
    price: float = Field(gt=0)
```
:::

---

## Response Schemas

Response schemas document the output shape in OpenAPI/Swagger. Define only the fields you actually return — never expose internal entity fields like `password_hash` or `internal_flags`.

```python
class UserData(BaseModel):
    id: int
    username: str
    email: str
    created_at: str

class GetUserResponse(BaseModel):
    success: bool
    data: Optional[UserData] = None
    error: Optional[str] = None
```

::: tip Schemas live in the plugin file
Request and response schemas are defined at the top of the plugin file, not in `models/`. The `models/` directory is reserved for database entity classes that mirror table structure. A plugin never imports from another plugin's schemas.
:::

---

## HTTP Endpoints

### Basic endpoint

```python
async def on_boot(self):
    self.http.add_endpoint(
        "/users/{user_id}",
        "GET",
        self.execute,
        tags=["Users"],
        request_model=GetUserRequest,
        response_model=GetUserResponse,
    )
```

The `data` dict in your handler is a flat merge of path parameters, query parameters, and the parsed request body. For the path `/users/{user_id}?include_profile=true`, `data` will contain both `user_id` and `include_profile`.

### Controlling the HTTP response

Use `HttpContext` to override status codes, set cookies, or add headers:

```python
async def execute(self, data: dict, context) -> dict:
    user = await self.db.query_one(
        "SELECT id, name FROM users WHERE id = $1", [data["user_id"]]
    )
    if user is None:
        context.set_status(404)
        return {"success": False, "error": "User not found"}

    context.set_status(200)
    context.set_header("X-User-Domain", "users")
    return {"success": True, "data": user}
```

Available context methods:

| Method | Description |
|---|---|
| `context.set_status(code)` | Override HTTP response code |
| `context.set_cookie(key, value, ...)` | Set a cookie with full kwargs support |
| `context.set_header(key, value)` | Add a custom response header |

---

## Protected Endpoints

Protect an endpoint by passing an `auth_validator` to `add_endpoint`. The validator receives the raw token string and must return a dict (the injected auth payload) or `None` (triggers HTTP 401).

```python
class GetOrderPlugin(BasePlugin):
    def __init__(self, db, http, auth, logger):
        self.db = db
        self.http = http
        self.auth = auth
        self.logger = logger

    async def on_boot(self):
        self.http.add_endpoint(
            "/orders/{order_id}",
            "GET",
            self.execute,
            tags=["Orders"],
            request_model=GetOrderRequest,
            response_model=GetOrderResponse,
            auth_validator=self._require_auth,
        )

    async def _require_auth(self, token: str) -> dict | None:
        return self.auth.validate_token(token)

    async def execute(self, data: dict, context) -> dict:
        user = data["_auth"]  # injected by auth_validator
        order_id = int(data["order_id"])
        order = await self.db.query_one(
            "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
            [order_id, user["sub"]],
        )
        if order is None:
            context.set_status(404)
            return {"success": False, "error": "Order not found"}
        return {"success": True, "data": order}
```

Token is extracted from `Authorization: Bearer <token>` or the `access_token` cookie — whichever is present.

**Role-based access control:**

```python
async def _require_admin(self, token: str) -> dict | None:
    payload = self.auth.validate_token(token)
    if payload is None:
        return None
    if payload.get("role") != "admin":
        return None  # 401 — insufficient role
    return payload
```

---

## Event Subscribers

Subscribe to events published by other plugins. Subscribers are decoupled from the publisher — no direct imports, no shared state.

```python
class WelcomeEmailPlugin(BasePlugin):
    def __init__(self, event_bus, logger):
        self.event_bus = event_bus
        self.logger = logger

    async def on_boot(self):
        await self.event_bus.subscribe("user.registered", self.on_user_registered)

    async def on_user_registered(self, data: dict) -> None:
        user_id = data["user_id"]
        email = data["email"]
        self.logger.info(f"Sending welcome email to {email}")
        # ... send email logic
```

::: info Subscriber signature
The callback receives only `data: dict`. There is no `event_name` second argument.
:::

### Event-based RPC

To participate in `event_bus.request()` RPC, return a non-`None` dict from your subscriber. Only one subscriber should handle each RPC event — if multiple subscribers return non-None, the first response wins.

```python
class PricingPlugin(BasePlugin):
    def __init__(self, db, event_bus):
        self.db = db
        self.event_bus = event_bus

    async def on_boot(self):
        await self.event_bus.subscribe("pricing.get_price", self.on_get_price)

    async def on_get_price(self, data: dict) -> dict:
        product = await self.db.query_one(
            "SELECT price FROM products WHERE id = $1", [data["product_id"]]
        )
        if product is None:
            return {"error": "Product not found", "price": None}
        return {"price": product["price"]}
```

The caller:

```python
pricing = await self.event_bus.request(
    "pricing.get_price",
    {"product_id": 42},
    timeout=2.0,
)
```

---

## Server-Sent Events (SSE)

SSE endpoints push data to the client over a persistent HTTP connection. Use them for live feeds, progress updates, or log streaming.

```python
import asyncio
import json
from core.base_plugin import BasePlugin


class OrderStatusStreamPlugin(BasePlugin):
    def __init__(self, http, event_bus, logger):
        self.http = http
        self.event_bus = event_bus
        self.logger = logger
        self._queues: list[asyncio.Queue] = []

    async def on_boot(self):
        await self.event_bus.subscribe("order.status_changed", self._on_status_change)
        self.http.add_sse_endpoint(
            "/orders/stream",
            self._stream,
            tags=["Orders"],
        )

    async def _on_status_change(self, data: dict) -> None:
        for q in self._queues:
            q.put_nowait(data)

    async def _stream(self, data: dict):
        q = asyncio.Queue()
        self._queues.append(q)
        try:
            while True:
                event = await q.get()
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            self._queues.remove(q)
```

::: tip Client disconnect
The `finally` block in your generator is guaranteed to run when the client disconnects. Always clean up queue references there to prevent memory leaks.
:::

---

::: info Observability
For metrics, real-time sinks, and OpenTelemetry tracing, see [Observability](/reference/observability).
:::

---

## Lifecycle Hooks

| Hook | When it runs | Use for |
|---|---|---|
| `async def on_boot(self)` | After all tools are ready | Register endpoints, subscribe to events, run migrations |
| `async def shutdown(self)` | On graceful shutdown | Close connections, flush buffers, unsubscribe |

```python
async def on_boot(self):
    self.config.require("STRIPE_SECRET_KEY")
    await self.event_bus.subscribe("payment.requested", self.on_payment)
    self.http.add_endpoint("/payments", "POST", self.execute, tags=["Payments"])

async def shutdown(self):
    await self.event_bus.unsubscribe("payment.requested", self.on_payment)
    self.logger.info("PaymentPlugin shut down cleanly")
```

---

## Best Practices

### 1. One file, one feature

Each plugin file handles exactly one endpoint or one event subscription. If a feature requires both an endpoint and event handling, split them into two plugin files in the same domain.

### 2. Avoid cross-domain imports
 
The architecture depends on keeping domains isolated. We strongly discourage importing from other domains (e.g., `from domains.users.models import UserEntity`). Such imports are easy to spot in review and undermine the benefits of the architecture. Instead, use `event_bus.request()` for cross-domain data needs.
 
```python
# Discouraged
from domains.users.models.user_entity import UserEntity
 
# Recommended
user = await self.event_bus.request("users.get_user", {"user_id": user_id})
```

### 3. Schemas inline, not from models/

Request and response schemas live at the top of the plugin file. The `models/` directory is for database entity mirror classes only.

### 4. Always validate with Field

Every field in every request schema must use `pydantic.Field` with constraints. No bare types.

### 5. Standard response envelope

Always return `{"success": bool, "data": ..., "error": ...}`. Use `context.set_status()` to set the HTTP status code — do not encode HTTP semantics in the `success` field alone.

### 6. Hybrid async

Use `async def` for I/O (database queries, HTTP calls, event publishing). If you have CPU-bound work (image processing, heavy computation), use a regular `def` method and call it from async — the Kernel runs sync methods in a thread pool automatically. Never call `time.sleep()` or any blocking I/O inside an `async def`.

### 7. Return plain dicts from handlers

FastAPI serializes the return value of your handler. If you construct Pydantic model instances inside the handler, call `.model_dump()` before returning:

```python
# Wrong
return {"success": True, "data": UserData(id=1, name="Alice")}

# Correct
return {"success": True, "data": UserData(id=1, name="Alice").model_dump()}
```

### 8. Declare only what you need

Declare only the tools your plugin actually uses in `__init__`. The DI container matches parameter names to tool names.

```python
# If you only need db and logger, declare only those
def __init__(self, db, logger):
    self.db = db
    self.logger = logger
```
