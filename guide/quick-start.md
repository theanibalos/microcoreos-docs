# Quick Start

Get up and running with MicroCoreOS in less than a minute.

## Installation

MicroCoreOS uses `uv` for lightning-fast dependency management.

```bash
# Clone the repository
git clone https://github.com/theanibalos/MicroCoreOS.git
cd MicroCoreOS

# Install dependencies and run
uv run main.py
```

The system will boot, run migrations, and start the HTTP server.

## Explore the System

### 1. Interactive API Docs
The Swagger UI is available at `http://localhost:5000/docs` when the server is running.

### 2. AI Manifest
Check the `AI_CONTEXT.md` file in the root directory. This is automatically updated with the live status of all tools and models.

### 3. Logs
Watch the `system.log` or your terminal to see the kernel's boot sequence and tool initialization.

## Your First Plugin

Creating a feature is as simple as adding a file to a domain.

```python
# domains/hello/plugins/greeting_plugin.py
from core.base_plugin import BasePlugin

class GreetingPlugin(BasePlugin):
    def __init__(self, http, logger):
        self.http = http
        self.logger = logger

    async def on_boot(self):
        self.http.add_endpoint("/hello", "GET", self.execute)

    async def execute(self, data: dict, context=None):
        self.logger.info("Greeting executed!")
        return {"success": True, "data": "Hello from MicroCoreOS!"}
```

That's it. Save it, restart, and visit `/hello`. No registrations, no imports, no ceremony.
