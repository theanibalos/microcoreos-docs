# Quick Start

This guide takes you from zero to a running MicroCoreOS server with your first custom endpoint. Estimated time: 5 minutes.

## Prerequisites

- Python 3.10 or newer
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/) installed (`pip install uv` or the official installer)

## 1. Clone and Run

```bash
git clone https://github.com/theanibalos/MicroCoreOS.git
cd MicroCoreOS
uv run main.py
```

`uv` will install all dependencies on the first run, then boot the server. You do not need to create a virtual environment manually.

## 2. What Just Happened

Watch the terminal output. You will see something like:

```
[Kernel] Discovering tools...
[Kernel] Booting tools in parallel...
[db] Connected to PostgreSQL
[http] Listening on http://0.0.0.0:5000
[Kernel] Discovering plugins...
[Kernel] Booting plugins...
[Kernel] Boot complete. 12 plugins ready.
```

The Kernel walked every `domains/*/plugins/` folder, found all plugin files, wired up their dependencies by name, and called `on_boot()` on each one — in the right order, automatically. You did not write any of that wiring.

## 3. Explore the API

Open **http://localhost:5000/docs** in your browser.

This is the live Swagger UI, auto-generated from every endpoint registered by every plugin. As you add plugins, new endpoints appear here instantly after a restart.

## 4. Your First Feature

You will add a greeting endpoint in three steps.

**Step 1.** Create the folder structure:

```
domains/
  hello/
    __init__.py
    plugins/
      __init__.py
      greeting_plugin.py
```

The `__init__.py` files can be empty. MicroCoreOS requires them to recognize the folders as Python packages.

**Step 2.** Write the plugin. Paste this into `domains/hello/plugins/greeting_plugin.py`:

```python
from core.base_plugin import BasePlugin


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

**Step 3.** Restart the server:

```bash
uv run main.py
```

Visit **http://localhost:5000/hello** or try it in Swagger. You should see:

```json
{
  "success": true,
  "data": "Hello from MicroCoreOS!"
}
```

::: tip No registration needed
The Kernel found `GreetingPlugin` by convention — it walked the folder, saw the class, matched `http` and `logger` to the running tools, and called `on_boot()`. You never touched `main.py`.
:::

## Next Steps

The quick start showed the absolute minimum. The full tutorial walks you through CRUD with a database and cross-domain events:

- [First Plugin (Tutorial)](/development/first-plugin) — Hello World → CRUD → Events, step by step.
- [Plugin Patterns (Reference)](/development/creating-plugins) — auth, SSE, HttpContext, and advanced patterns.
