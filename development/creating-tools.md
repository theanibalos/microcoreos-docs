# Creating Tools

Tools are the infrastructure layer of MicroCoreOS. They provide technical capabilities to Plugins and are designed to be stateless and isolated.

## Tool Structure

A tool lives in `tools/{tool_name}/{tool_name}_tool.py` and inherits from `BaseTool`.

```python
from core.base_tool import BaseTool

class MyServiceTool(BaseTool):
    @property
    def name(self) -> str:
        # This is the name used for Dependency Injection
        return "my_service"

    def setup(self):
        # 1. Resource Allocation Phase
        # Initialize connections, clients, or load environment variables.
        print("[MyService] Initializing...")

    def get_interface_description(self) -> str:
        # 2. Self-Documentation Phase
        # This string is used to auto-generate AI_CONTEXT.md.
        # Be explicit with method signatures for better AI performance.
        return """
        My Service Tool (my_service):
        - PURPOSE: Provides access to external XYZ capability.
        - CAPABILITIES:
            - do_something(data: dict) -> dict: Processes XYZ and returns a result.
        """

    def on_boot_complete(self, container):
        # 3. Finalization Phase (Optional)
        # Called after ALL tools and plugins are initialized.
        # You can access other tools via the container if needed.
        pass

    async def on_instrument(self, tracer_provider) -> None:
        # 4. OTel Instrumentation Phase (Optional)
        # Called by TelemetryTool when OTEL_ENABLED=true, AFTER on_boot_complete.
        # Runs on the raw tool instance, bypassing ToolProxy — a failure here
        # will never mark your tool as DEAD.
        #
        # Implement this if your tool wraps a framework that has its own
        # OpenTelemetry instrumentation library (e.g. FastAPI, asyncpg, Redis).
        # This adds driver-level spans on top of the automatic ToolProxy spans.
        #
        # Example for a hypothetical Redis tool:
        #   from opentelemetry.instrumentation.redis import RedisInstrumentor
        #   RedisInstrumentor().instrument(tracer_provider=tracer_provider)
        #
        # If you don't implement this, your tool still gets automatic spans
        # for every method call via ToolProxy — no action needed.
        pass

    def shutdown(self):
        # 5. Cleanup Phase
        # Close connections and release resources gracefully.
        print("[MyService] Cleaning up...")

    # --- Capability Methods ---
    def do_something(self, data: dict):
        return {"result": f"Processed {data}"}
```

## Rules for Tools

1. **Stateless**: Tools should not contain business logic or domain-specific state. They are pure "capabilities".
2. **Naming**: The `name` property must be unique. This is how the Kernel identifies the tool for injection.
3. **DI**: Tools are injected into Plugins by matching the parameter name in the Plugin's `__init__`.
4. **No Cross-Tool Imports**: Tools should never import or depend on other tools directly. If you need coordination, move that logic to a Plugin.

## Lifecycle Summary

| Hook | When it runs | Required |
|------|-------------|----------|
| `setup()` | Before any plugin boots | Yes |
| `get_interface_description()` | On boot — feeds `AI_CONTEXT.md` | Yes |
| `on_boot_complete(container)` | After all tools and plugins are ready | No |
| `on_instrument(tracer_provider)` | When `OTEL_ENABLED=true`, after `on_boot_complete` | No |
| `shutdown()` | On graceful shutdown | No |

::: warning get_interface_description() is mandatory
If this method returns an empty string, the system will print a warning on every boot:
`[ContextTool] WARNING: Tool 'my_tool' has no interface description.`
Document your tool's capabilities here — it's what the AI reads to know how to use it.
:::

## OTel Instrumentation: two levels

When `OTEL_ENABLED=true`, your tool gets observability at two levels automatically:

**Level 1 — ToolProxy spans (automatic, no code needed)**
Every call to your tool's public methods gets a span with: tool name, method name, duration, success/fail. This happens for ALL tools with zero implementation.

**Level 2 — Driver-level spans (optional, via `on_instrument`)**
If your tool wraps a framework with its own OTel library, implement `on_instrument` to activate it. This adds richer data: SQL query text, HTTP route details, cache hit/miss, etc.

```python
# Example: a PostgreSQL tool
async def on_instrument(self, tracer_provider) -> None:
    try:
        from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
        AsyncPGInstrumentor().instrument(tracer_provider=tracer_provider)
    except ImportError:
        pass  # degrade gracefully if package not installed
```

::: tip
Always wrap `on_instrument` in try/except ImportError so the tool works even when the OTel instrumentation package is not installed.
:::

## Integration

Once created, the Kernel will automatically discover and load your tool if it's placed in the `tools/` directory. No manual registration is required.
