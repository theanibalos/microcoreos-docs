# Quick Start

This guide takes you from zero to a running MicroCoreOS application with your first custom endpoint. Estimated time: 2 minutes.

## 🚀 Recommended: Using `uv` (Fastest)

[`uv`](https://docs.astral.sh/uv/) is the recommended, ultra-fast tool for managing Python projects and dependencies in MicroCoreOS.

```bash
# 1. Initialize project
uv init my_app
cd my_app

# 2. Add microcoreos dependency
uv add microcoreos

# 3. Scaffold directory structure
uv run microcoreos new .

# 4. Boot server
uv run main.py
```

---

## 📦 Alternative: Using standard `pip`

If you prefer standard `pip` and virtual environments:

```bash
# 1. Install microcoreos package
pip install microcoreos

# 2. Scaffold new project
microcoreos new my_app
cd my_app

# 3. Boot server
microcoreos run
```

---

## 🔍 System Inspection & Plan Commands

Run the CLI inspection tools anytime:

```bash
uv run microcoreos status            # Displays active plan & context manifest freshness
uv run microcoreos plan validate     # Validates offline plan rules
```

---

## ✍️ Write Your First Plugin

Add a custom greeting plugin in a single file. Create `domains/hello/plugins/greeting_plugin.py`:

```python
from microcoreos import BasePlugin


class GreetingPlugin(BasePlugin):
    def __init__(self, http, logger):
        self.http = http
        self.logger = logger

    async def on_boot(self):
        self.http.add_endpoint("/hello", "GET", self.execute, tags=["Hello"])

    async def execute(self, data: dict, context=None):
        self.logger.info("Greeting executed!")
        return {"success": True, "data": "Hello from MicroCoreOS!"}
```

Restart the server:

```bash
uv run main.py
```

Visit **http://localhost:6060/hello** or inspect **http://localhost:6060/docs** (Swagger UI). You will receive:

```json
{
  "success": true,
  "data": "Hello from MicroCoreOS!"
}
```

::: tip Zero Wiring Needed
The Kernel discovered `GreetingPlugin` by convention, injected `http` and `logger` by name, and bound the route. You never edited `main.py` or a router file.
:::

## Next Steps

- [First Plugin (Tutorial)](/development/first-plugin) — Hello World → CRUD → Events, step by step.
- [Elastic Deployment](/guide/elastic-deployment) — Swap SQLite for PostgreSQL or Redis Streams with zero plugin changes.
- [Testing & MicroCoreBench](/development/testing) — Learn how to run unit tests, mutation testing (`mutmut`), and load tests.
