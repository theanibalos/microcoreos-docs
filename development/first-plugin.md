# First Plugin (Tutorial)

This tutorial builds progressively. Each level is complete and runnable on its own, and each one extends what came before.

- **Level 1** — One endpoint, no database.
- **Level 2** — A real CRUD API backed by a database.
- **Level 3** — Cross-domain communication with events.

If you have not run the server yet, start with the [Quick Start](/guide/quick-start) first.

---

## Level 1: Hello World

The smallest possible plugin. One file, one endpoint, two injected tools.

### Create the file

```
domains/
  hello/
    __init__.py
    plugins/
      __init__.py
      greeting_plugin.py
```

Create empty `__init__.py` files, then paste this into `greeting_plugin.py`:

```python
# domains/hello/plugins/greeting_plugin.py
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

Restart with `uv run main.py` and visit `http://localhost:5000/hello`.

### What each part does

| Part | What it does |
|---|---|
| `def __init__(self, http, logger)` | Declares which tools this plugin needs. The Kernel matches parameter names to tool names and injects them automatically. |
| `async def on_boot(self)` | Called once, after all tools are ready. This is where you register endpoints, subscribe to events, or run migrations. |
| `self.http.add_endpoint(...)` | Registers a route on the HTTP server. The `tags` list controls which Swagger group the endpoint appears under. |
| `async def execute(self, data: dict, context=None)` | The request handler. `data` is a flat dict of path params, query params, and body fields merged together. |
| `{"success": bool, "data": ...}` | The standard response envelope used by every endpoint in MicroCoreOS. |

::: tip No registration, no imports from main.py
The Kernel discovers `GreetingPlugin` by walking `domains/*/plugins/`. Naming matters: the class must end in `Plugin`. That is the only convention.
:::

---

## Level 2: CRUD with a Database

Build a notes API: create a note, list all notes, get one by ID.

The rule is **1 file = 1 feature**, so three endpoints means three plugin files.

### Domain structure

```
domains/
  notes/
    __init__.py
    models/
      __init__.py
      note.py
    migrations/
      001_create_notes.sql
    plugins/
      __init__.py
      create_note_plugin.py
      list_notes_plugin.py
      get_note_plugin.py
```

### Migration

```sql
-- domains/notes/migrations/001_create_notes.sql
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

The `db` tool runs all `migrations/*.sql` files in filename order on boot. The `IF NOT EXISTS` guard makes it safe to re-run.

### Entity model

```python
# domains/notes/models/note.py
from pydantic import BaseModel


class NoteEntity(BaseModel):
    id: int
    title: str
    content: str
    created_at: str
```

::: info models/ is for DB mirrors only
`NoteEntity` mirrors the table structure. It is NOT used in plugin responses. Request and response schemas live inside each plugin file.
:::

### Plugin 1: Create a note

```python
# domains/notes/plugins/create_note_plugin.py
from typing import Optional
from pydantic import BaseModel, Field
from core.base_plugin import BasePlugin


class CreateNoteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200, description="Note title")
    content: str = Field(min_length=1, max_length=10000, description="Note body")


class NoteData(BaseModel):
    id: int
    title: str
    content: str
    created_at: str


class CreateNoteResponse(BaseModel):
    success: bool
    data: Optional[NoteData] = None
    error: Optional[str] = None


class CreateNotePlugin(BasePlugin):
    def __init__(self, db, http, logger):
        self.db = db
        self.http = http
        self.logger = logger

    async def on_boot(self):
        self.http.add_endpoint(
            "/notes",
            "POST",
            self.execute,
            tags=["Notes"],
            request_model=CreateNoteRequest,
            response_model=CreateNoteResponse,
        )

    async def execute(self, data: dict, context=None) -> dict:
        try:
            req = CreateNoteRequest(**data)
            row = await self.db.query_one(
                "INSERT INTO notes (title, content) VALUES ($1, $2) "
                "RETURNING id, title, content, created_at::text",
                [req.title, req.content],
            )
            return {"success": True, "data": dict(row)}
        except Exception as e:
            self.logger.error(f"Failed to create note: {e}")
            return {"success": False, "error": str(e)}
```

::: info PostgreSQL placeholders
Always use `$1`, `$2`, `$3` — never `?`. MicroCoreOS uses asyncpg, which follows the PostgreSQL parameter style.
:::

### Plugin 2: List all notes

```python
# domains/notes/plugins/list_notes_plugin.py
from typing import Optional
from pydantic import BaseModel
from core.base_plugin import BasePlugin


class NoteItem(BaseModel):
    id: int
    title: str
    created_at: str


class ListNotesResponse(BaseModel):
    success: bool
    data: Optional[list[NoteItem]] = None
    error: Optional[str] = None


class ListNotesPlugin(BasePlugin):
    def __init__(self, db, http, logger):
        self.db = db
        self.http = http
        self.logger = logger

    async def on_boot(self):
        self.http.add_endpoint(
            "/notes",
            "GET",
            self.execute,
            tags=["Notes"],
            response_model=ListNotesResponse,
        )

    async def execute(self, data: dict, context=None) -> dict:
        try:
            rows = await self.db.query(
                "SELECT id, title, created_at::text FROM notes ORDER BY created_at DESC"
            )
            return {"success": True, "data": [dict(r) for r in rows]}
        except Exception as e:
            self.logger.error(f"Failed to list notes: {e}")
            return {"success": False, "error": str(e)}
```

### Plugin 3: Get one note by ID

```python
# domains/notes/plugins/get_note_plugin.py
from typing import Optional
from pydantic import BaseModel
from core.base_plugin import BasePlugin


class NoteData(BaseModel):
    id: int
    title: str
    content: str
    created_at: str


class GetNoteResponse(BaseModel):
    success: bool
    data: Optional[NoteData] = None
    error: Optional[str] = None


class GetNotePlugin(BasePlugin):
    def __init__(self, db, http, logger):
        self.db = db
        self.http = http
        self.logger = logger

    async def on_boot(self):
        self.http.add_endpoint(
            "/notes/{id}",
            "GET",
            self.execute,
            tags=["Notes"],
            response_model=GetNoteResponse,
        )

    async def execute(self, data: dict, context=None) -> dict:
        try:
            note_id = int(data["id"])
            row = await self.db.query_one(
                "SELECT id, title, content, created_at::text FROM notes WHERE id = $1",
                [note_id],
            )
            if row is None:
                context.set_status(404)
                return {"success": False, "error": "Note not found"}
            return {"success": True, "data": dict(row)}
        except Exception as e:
            self.logger.error(f"Failed to get note: {e}")
            return {"success": False, "error": str(e)}
```

`context.set_status(404)` sets the HTTP response code without touching the response body. The envelope is always the same shape.

Restart and open `/docs`. You will see three endpoints grouped under **Notes**.

---

## Level 3: Events (Cross-Domain Communication)

When a note is created, other domains should be able to react — without being imported or called directly. MicroCoreOS uses an event bus for this.

### Publish from create_note_plugin.py

Add `event_bus` to the constructor and publish after the insert:

```python
# domains/notes/plugins/create_note_plugin.py  (updated)
class CreateNotePlugin(BasePlugin):
    def __init__(self, db, http, logger, event_bus):  # add event_bus
        self.db = db
        self.http = http
        self.logger = logger
        self.event_bus = event_bus

    # on_boot stays the same

    async def execute(self, data: dict, context=None) -> dict:
        try:
            req = CreateNoteRequest(**data)
            row = await self.db.query_one(
                "INSERT INTO notes (title, content) VALUES ($1, $2) "
                "RETURNING id, title, content, created_at::text",
                [req.title, req.content],
            )
            note = dict(row)

            # Publish the event — fire and forget
            await self.event_bus.publish("note.created", {
                "id": note["id"],
                "title": note["title"],
            })

            return {"success": True, "data": note}
        except Exception as e:
            self.logger.error(f"Failed to create note: {e}")
            return {"success": False, "error": str(e)}
```

### Create the notifications domain

```
domains/
  notifications/
    __init__.py
    plugins/
      __init__.py
      note_created_handler_plugin.py
```

```python
# domains/notifications/plugins/note_created_handler_plugin.py
from core.base_plugin import BasePlugin


class NoteCreatedHandlerPlugin(BasePlugin):
    def __init__(self, event_bus, logger):
        self.bus = event_bus
        self.logger = logger

    async def on_boot(self):
        await self.bus.subscribe("note.created", self.on_note_created)

    async def on_note_created(self, data: dict) -> None:
        self.logger.info(f"New note created: {data['title']}")
        # In a real app: send an email, push a notification, call an external API, etc.
```

This plugin has no HTTP endpoint. It only subscribes to an event. That is a valid plugin — the Kernel boots it the same way.

::: tip Subscriber signature
The callback receives only `data: dict`. There is no `event_name` second argument.
:::

::: info No cross-domain imports
`NoteCreatedHandlerPlugin` does not import anything from `domains/notes/`. The `note.created` string is the only contract between the two domains. You can move, rename, or rewrite either domain independently.
:::

Restart the server. Create a note via `POST /notes`. You will see the log line from `NoteCreatedHandlerPlugin` in the terminal immediately after the insert.

---

## What's Next

You now know the fundamentals of MicroCoreOS:

- How the Kernel discovers and boots plugins
- How to build HTTP endpoints with request and response schemas
- How to talk to the database with `$1` placeholders
- How to set HTTP status codes with `context.set_status()`
- How to communicate across domains without imports

For protected endpoints, SSE streaming, HttpContext, and advanced event patterns, see [Plugin Patterns (Reference)](/development/creating-plugins).
