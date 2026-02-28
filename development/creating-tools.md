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

    def shutdown(self):
        # 4. Cleanup Phase
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

## Integration

Once created, the Kernel will automatically discover and load your tool if it's placed in the `tools/` directory. No manual registration is required.
