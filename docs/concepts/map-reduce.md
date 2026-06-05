# Map-Reduce Analysis

The `map-reduce-analyze` tool enables analysis of codebases that are too large to fit within a single Gemini context window. It works by sharding the workspace into manageable pieces, running Gemini on each shard in parallel, and then synthesizing the individual results into one coherent answer.

## How It Works

### 1. File Collection

The tool walks the target directory recursively, collecting all files and their byte sizes. Common noise directories (`node_modules`, `.git`, `dist`, `.gemini-mcp`, `.tmptest`) are skipped automatically.

### 2. Sharding

Files are greedy bin-packed into shards so that each shard stays close to the target size (`shardBytes`, default 800 KB). The algorithm:

- Never splits a file across two shards.
- Preserves input order within and across shards.
- Places an oversized file (larger than `shardBytes`) in its own shard.

### 3. Map Phase

Each shard is sent to Gemini with the user's prompt and the shard's file references. Shards run in parallel, bounded by the `concurrency` setting (default 4, capped at 10). A shard failure is recorded but does not abort the rest of the run.

### 4. Reduce Phase

When there is more than one shard, the per-shard answers are collected and sent to Gemini again with a synthesis prompt. The final output is this synthesized answer.

If only one shard is needed, the reduce step is skipped and the single map result is returned directly.

## Usage

```
map-reduce-analyze(
  prompt: "Identify all potential security vulnerabilities",
  paths: "src",
  concurrency: 4,
  shardBytes: 800000
)
```

### Parameters

| Parameter     | Required | Default                               | Description |
|---------------|----------|---------------------------------------|-------------|
| `prompt`      | Yes      | —                                     | The analysis question applied to the whole workspace. |
| `paths`       | No       | `.`                                   | Root directory to analyze, relative to the project root. |
| `concurrency` | No       | `GEMINI_MCP_MAP_CONCURRENCY` or `4`  | Max parallel Gemini calls (clamped to 1–10). |
| `shardBytes`  | No       | `800000`                              | Target bytes per shard. Raise this to produce fewer shards. |

## Configuration

Set `GEMINI_MCP_MAP_CONCURRENCY` in the environment to change the default concurrency for all map-reduce calls without passing it explicitly each time.

## Limits

- **Maximum shards: 50.** If the workspace produces more than 50 shards at the given `shardBytes`, the tool returns an error with guidance on how to increase `shardBytes` to stay within the limit.
- **Concurrency: 1–10.** Values outside this range are clamped automatically.
- **Path confinement.** All file access is restricted to the project directory. Paths that resolve outside it are rejected.

## When to Use

Use `map-reduce-analyze` when:

- `ask-gemini` times out or hits context-length limits on a large codebase.
- You need a whole-repository view (architecture summaries, security audits, dependency graphs).
- You want a thorough, complete analysis rather than a sample.

For targeted questions about specific files, `ask-gemini` with `@file` references remains the faster option.
