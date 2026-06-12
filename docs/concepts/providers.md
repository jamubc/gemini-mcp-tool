# Providers and the State Store

This page describes two foundational internal constructs introduced in v1.1.9:
the **provider seam** that makes the Gemini execution backend pluggable, and
the **state store** that gives tools a place to persist data between calls.

---

## Provider seam

### Motivation

All Gemini interactions previously flowed through a single hard-wired call to
`executeGeminiCLI`. Introducing the provider seam decouples the *tool layer*
from the *execution layer* so that future backends — such as a direct REST call
with `GEMINI_API_KEY` — can be plugged in without modifying tool code.

### Core types (`src/providers/types.ts`)

```ts
export type ProviderId = 'cli' | 'api' | 'antigravity';

export interface ProviderRequest {
  prompt: string;
  model?: string;
  sandbox?: boolean;
  changeMode?: boolean;
  onProgress?: (s: string) => void;
}

export interface GeminiProvider {
  readonly id: ProviderId;
  run(req: ProviderRequest): Promise<string>;
}
```

A `GeminiProvider` receives a `ProviderRequest` and returns the raw Gemini
response string — the same contract as `executeGeminiCLI`.

### Available providers

| ID | Class | Behaviour |
|----|-------|-----------|
| `cli` | `CliProvider` | Default. Wraps `executeGeminiCLI`; behaviour is identical to earlier releases. |
| `api` | `ApiProvider` | Stub. Every call rejects with an actionable error asking the operator to set `GEMINI_API_KEY`. Intended as the seam for a direct-API backend. |
| `antigravity` | *(reserved)* | Falls back to `CliProvider` for forward compatibility. |

### Selecting a provider

Set the `GEMINI_MCP_PROVIDER` environment variable before starting the server:

```sh
GEMINI_MCP_PROVIDER=cli   # default; uses the gemini CLI
GEMINI_MCP_PROVIDER=api   # direct-API stub (not yet functional)
```

Unknown values throw a startup-time error with a list of valid ids.

### Using the provider in a tool

```ts
import { getProvider } from '../providers/index.js';

const provider = getProvider();
const result = await provider.run({ prompt, model, sandbox, changeMode, onProgress });
```

`getProvider()` reads `GEMINI_MCP_PROVIDER` and caches the instance per id.
Call `resetProviderCache()` (exported from the same module) in tests to obtain
a fresh instance between cases.

### Testability

`CliProvider` accepts an optional executor function at construction time so
unit tests can inject a fake without spawning a subprocess:

```ts
const provider = new CliProvider(async (req) => 'fake response');
const result = await provider.run({ prompt: 'hello' });
// result === 'fake response'
```

---

## State store

### Motivation

Tools occasionally need to persist small amounts of data across MCP calls —
caches, counters, flags. The state store provides a uniform interface for both
ephemeral (in-memory) and durable (file-backed) storage without coupling tools
to a specific persistence strategy.

### Interface (`src/state/store.ts`)

```ts
export interface StateStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  keys(): string[];
}
```

### Implementations

#### `MemoryStore`

Backed by a plain `Map`. Data is lost when the process exits. Suitable for
caches that are cheap to rebuild.

```ts
import { MemoryStore } from '../state/store.js';

const store = new MemoryStore();
store.set('counter', 0);
```

#### `JsonFileStore`

Persists each key as a JSON file under a directory. The directory is created
lazily on the first write.

```ts
import { JsonFileStore } from '../state/store.js';

const store = new JsonFileStore();   // uses GEMINI_MCP_STATE_DIR or .gemini-mcp/
store.set('last-run', new Date().toISOString());
const value = store.get<string>('last-run');
```

Pass an explicit directory path to the constructor to override the default:

```ts
const store = new JsonFileStore('/tmp/my-tool-state');
```

### Key rules

Keys must match `^[A-Za-z0-9._-]{1,128}$`. The following are rejected:

- Empty strings
- Absolute paths (e.g. `/etc/passwd`)
- Path traversal sequences (e.g. `../secret`)
- Keys containing `/` or `\`

These constraints ensure that keys are safe to use as file names and cannot
be used to escape the configured storage directory.

### Configuring the storage directory

Set `GEMINI_MCP_STATE_DIR` to an absolute path before starting the server:

```sh
GEMINI_MCP_STATE_DIR=/var/lib/my-mcp-state
```

The default is `.gemini-mcp/` inside the working directory. This directory is
listed in `.gitignore` so persisted state is not accidentally committed.

---

## Environment variable reference

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_MCP_PROVIDER` | `cli` | Selects the Gemini execution backend. |
| `GEMINI_MCP_STATE_DIR` | `.gemini-mcp/` | Root directory for `JsonFileStore` persistence. |
| `GEMINI_API_KEY` | *(unset)* | Required by the `api` provider once it is fully implemented. |
