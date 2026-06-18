# Second Opinion (Blind Independent Review)

The `second-opinion` tool sends a problem to Gemini and obtains a completely independent answer — one that is never shown the orchestrator's existing analysis. This prevents *anchoring bias*, where a model's output is unconsciously shaped by a prior answer it was shown.

## Why anchoring matters

When a model is shown an existing answer before being asked to evaluate or improve it, it tends to:

- Adopt the framing and assumptions of the prior answer uncritically
- Miss alternative approaches that the first answer did not consider
- Agree with the prior answer even when it contains errors

By hiding the orchestrator's answer from the independent solve step, the `second-opinion` tool ensures the second perspective is genuinely fresh.

## How it works

1. **Blind solve** — The problem text is sent to Gemini with a prompt that instructs it to reason from first principles. The orchestrator's own answer is *not* included in this call, regardless of whether one is provided.

2. **Optional comparison** — If `ownAnswer` is provided and `compare` is `true` (the default), a second call compares the two answers and lists agreements and divergences. This comparison step can freely see both answers because the independent answer is already locked in.

## Usage

### Independent answer only

```json
{
  "tool": "second-opinion",
  "problem": "What database indexing strategy should we use for a write-heavy time-series workload?"
}
```

The tool returns the independent answer under a `## Independent answer` heading.

### With divergence comparison

```json
{
  "tool": "second-opinion",
  "problem": "What database indexing strategy should we use for a write-heavy time-series workload?",
  "ownAnswer": "We should use a B-tree index on the timestamp column and partition by month.",
  "compare": true
}
```

The tool returns the independent answer and then a `## Points of divergence` section that lists where the two answers agree or differ and which position is better supported.

### Skipping the comparison

Set `compare: false` to obtain only the independent answer even when `ownAnswer` is provided. This is useful when you want the raw independent perspective without the comparison overhead.

```json
{
  "tool": "second-opinion",
  "problem": "Explain the tradeoffs between eventual and strong consistency.",
  "ownAnswer": "Strong consistency is always safer.",
  "compare": false
}
```

## Parameters

| Parameter   | Type    | Required | Default        | Description |
|-------------|---------|----------|----------------|-------------|
| `problem`   | string  | yes      | —              | The problem or question to be answered independently. Must contain only the problem — no existing answer. |
| `ownAnswer` | string  | no       | —              | The orchestrator's own answer. Used only in the optional compare step; never forwarded to the solve call. |
| `model`     | string  | no       | gemini-2.5-pro | Gemini model to use for both calls. |
| `compare`   | boolean | no       | `true`         | Whether to run the divergence comparison when `ownAnswer` is provided. |

## Output format

```
## Independent answer

<Gemini's independent answer>

---

## Points of divergence

<Comparison of the two answers, listing agreements and divergences>
```

The `## Points of divergence` section is omitted if `ownAnswer` was not provided or `compare` is `false`.

## Anti-anchoring guarantee

The `buildSolvePrompt` function — which constructs the prompt for the independent solve call — accepts only the `problem` string. It has no parameter for an existing answer. This is enforced both by the TypeScript type signature and by the tool's execution flow, where `ownAnswer` is explicitly kept out of the first executor call and is only passed to `buildComparePrompt` in the second call.
