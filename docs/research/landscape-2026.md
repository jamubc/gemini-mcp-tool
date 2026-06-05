# Product & Solution Landscape: Trends and Emerging Adoption (2026)

> **Scope.** A research briefing on where `gemini-mcp-tool` sits in the fast-moving
> Model Context Protocol (MCP) ecosystem — the competitive landscape, emerging
> adoption patterns, and the structural trends that shape the tool's future.
>
> **Date:** 2026-06-05 · **Status:** Living document · **Method:** Multi-source
> web research with adversarial verification. Each claim carries a confidence
> marker — **[H]** high (primary source / multi-source corroboration),
> **[M]** medium (single credible source or directional figures), **[L]** low
> (uncorroborated snippet). Numbers are point-in-time and drift.

---

## Executive summary

1. **MCP went from one vendor's protocol to industry infrastructure in ~18 months.**
   Anthropic open-sourced MCP in November 2024; by 2026 it is supported by OpenAI,
   Google, Microsoft, and AWS, has an official registry, and was donated to a
   Linux Foundation–affiliated body. `gemini-mcp-tool` rides this tide. **[H]**

2. **`gemini-mcp-tool` occupies a distinct niche:** it bridges Claude Code to
   Google's *Gemini CLI* (the binary, not the raw API), inheriting the CLI's
   large-context `@file` ingestion and free-tier auth. Its pitch — "use Gemini's
   massive context window to analyze large codebases and save Claude's tokens" —
   maps directly onto the single hottest pattern in agentic coding: **context
   economics**. **[H]**

3. **The biggest emerging trend is multi-model orchestration / delegation.**
   A whole category of MCP servers now exists to let one agent (Claude Code)
   delegate bulk reading or "second opinions" to another model (Gemini, GPT, Grok).
   `gemini-mcp-tool` is a focused single-backend member of this category. **[H]**

4. **The single most important risk is a substrate change, not a competitor.**
   At Google I/O 2026 (May 19), Google announced it is **transitioning Gemini CLI
   to "Antigravity CLI," with the free/Pro/Ultra individual tiers ceasing to serve
   requests on June 18, 2026.** Because `gemini-mcp-tool` shells out to the Gemini
   CLI, this is an existential dependency event that should shape the roadmap. **[H]**

5. **Security has become a maturity gate.** `gemini-mcp-tool` shipped a fix for a
   critical command-injection RCE (**CVE-2026-0755, CVSS 9.8**) in v1.1.6 — part of
   an ecosystem-wide reckoning with tool poisoning and prompt injection in MCP. **[H]**

---

## 1. The subject: `gemini-mcp-tool` adoption snapshot

`gemini-mcp-tool` is an MIT-licensed MCP server (≈80% TypeScript) that lets MCP
clients — primarily Claude Code and Claude Desktop — drive Google's Gemini CLI.
It exposes the Gemini CLI's `@file`/`@dir` syntax so an agent can offload analysis
of large files and whole codebases to Gemini's large token window.
([README](https://github.com/jamubc/gemini-mcp-tool)) **[H]**

**Adoption signals (as of 2026-06-05):**

| Signal | Value | Confidence |
| --- | --- | --- |
| GitHub stars / forks | ~2,227 / ~194 | [H] (live API) |
| Created | 2025-06-29 | [H] |
| Latest stable release | **v1.1.7** (2026-06-01) | [H] |
| npm downloads | ~1,000/week (moving avg.) | [M] |
| Directory listings | Glama, Smithery, mcp.so, PulseMCP, LobeHub, Playbooks, fastmcp.me | [H] |
| Third-party forks | `gemini-mcp-tool-windows-fixed`, `@iflow-mcp/...`, `@maxanatsko/...` | [M] |

Sources: [GitHub repo](https://github.com/jamubc/gemini-mcp-tool) ·
[Smithery](https://smithery.ai/server/@jamubc/gemini-mcp-tool) ·
[Glama](https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool) ·
[PulseMCP](https://www.pulsemcp.com/servers?q=gemini)

**Tooling surface.** Core AI-facing tools are `ask-gemini` (default model
`gemini-2.5-pro`, optional `sandbox`) and `sandbox-test`, plus `Ping`/`Help`
utilities and the `/analyze`, `/sandbox`, `/help`, `/ping` slash commands. Beyond
the README, the tool surface has grown to include **`brainstorm`** (ideation with
divergent/convergent/SCAMPER/design-thinking methodologies), **`fetch-chunk`**
(retrieve cached chunks of a large response), and a **`changeMode`** that has
Gemini emit deterministic OLD/NEW edit blocks Claude can apply by exact match. **[M]**

**Release pattern.** A long quiet stretch after v1.1.2 (2025-07-13) was followed
by a burst of patches in late May–June 2026 (v1.1.5 → v1.1.7), driven largely by
**security hardening** and **Windows/stdin reliability**, and the project's first
automated `node:test` suite (CI-gated on Node 18/20/22). This is the profile of a
project moving from "useful hack" toward "maintained dependency." **[H]**
([releases](https://github.com/jamubc/gemini-mcp-tool/releases))

---

## 2. MCP ecosystem trends (2025–2026)

The protocol underneath the tool matured dramatically, which is the rising tide
lifting tools like this one.

- **Standardization & cross-vendor adoption.** Anthropic announced MCP on
  2024-11-25. **OpenAI** adopted it (2025-03-26, Agents SDK + ChatGPT/Responses
  API), **Google DeepMind** committed in April 2025 (Hassabis: "rapidly becoming an
  open standard for the AI agentic era"), and **Microsoft** (Copilot Studio /
  Foundry) and **AWS** (Bedrock, AgentCore) followed. **[H]**
  ([Anthropic](https://www.anthropic.com/news/model-context-protocol) ·
  [Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services))

- **An official registry and explosive directory growth.** The official **MCP
  Registry** launched in preview 2025-09-08 (built by PulseMCP, Block, GitHub,
  Anthropic) and held ~2,000 entries by its first-anniversary post (2025-11-25,
  +407% from launch). Third-party directories index far more — Glama ~31k, mcp.so
  20k+, PulseMCP ~16k — using different counting methods, so headline counts are
  directional. **[H]/[M]**
  ([Registry preview](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/) ·
  [1-year post](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/))

- **Protocol evolution toward remote, authenticated, interactive servers.**
  Streamable HTTP transport (2025-03-26 spec) replaced HTTP+SSE; the 2025-06-18
  spec made servers OAuth 2.1 resource servers and added **elicitation**
  (mid-session user input); the 2025-11 cycle added async task workflows, M2M auth,
  enterprise IdP controls, and **MCP Apps** (SEP-1865) standardizing server-delivered
  interactive UIs (`ui://`) rendered inline in Claude, ChatGPT, and Cursor. **[H]**
  ([transports](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) ·
  [auth](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) ·
  [MCP Apps](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/))

- **Governance.** Anthropic donated MCP to the **Agentic AI Foundation** (Linux
  Foundation–directed) ~Dec 2025, with OpenAI, Google, Microsoft, AWS, Cloudflare
  and Bloomberg backing — formalizing vendor neutrality. **[M]**

- **Usage scale.** MCP SDK downloads reportedly grew from ~100k (Nov 2024) to 8M+
  (Apr 2025) toward ~97M/month ~16 months in; remote servers ~4× since May 2025. **[M]**

**Implication for `gemini-mcp-tool`:** the protocol's move to remote/HTTP +
OAuth and registry distribution is an opportunity (easier discovery, hosted
deployment) the tool has not yet leaned into — it remains a local stdio,
`npx`-launched server.

---

## 3. The substrate: Gemini CLI — and the Antigravity disruption

`gemini-mcp-tool`'s power and its risk both flow from one dependency: **Google's
Gemini CLI**.

**Why the CLI is a strong substrate.** Launched 2025-06-25 (Apache-2.0), Gemini
CLI crossed **~105,000 GitHub stars** within a year and is itself an agent that is
*also an MCP client* (it consumes external MCP servers via `settings.json`, with
stdio/SSE/HTTP transports, OAuth discovery, and an Extensions framework + gallery).
Its free personal tier offered **Gemini 2.5 Pro with a 1M-token context at 60
req/min and 1,000 req/day** — effectively a near-free large-context worker. **[H]**
([Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-cli-open-source-ai-agent/) ·
[gemini-cli](https://github.com/google-gemini/gemini-cli) ·
[MCP docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md))

**Model trajectory.** Gemini 3 Pro (2025-11-18) and the subsequent 3.1 Pro pushed
coding benchmarks well past 2.5 Pro (e.g., Gemini 3 Pro ~76.2% SWE-bench Verified),
all with 1M-token input — strengthening the "delegate the big read to Gemini" case. **[H]/[M]**

**The disruption (critical).** At **Google I/O 2026 (May 19)**, Google announced it
is **transitioning Gemini CLI to "Antigravity CLI,"** and that **Gemini CLI / Gemini
Code Assist individual tiers (free, AI Pro, Ultra) stop serving requests on
June 18, 2026.** Enterprise license holders and paid API keys retain access. Early
reports flag that Antigravity CLI lacks 1:1 feature parity and uses a *weekly*
(not daily) quota that users exhaust quickly. **[H]**
([Google Developers Blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) ·
[The Register](https://www.theregister.com/ai-ml/2026/05/20/bye-bye-gemini-cli-google-nudges-devs-toward-antigravity/5243605) ·
[GitHub Discussion #27274](https://github.com/google-gemini/gemini-cli/discussions/27274))

**Why this matters here:** because the tool shells out to the Gemini CLI binary
and relies on its free-tier auth, the June 18 cutoff is a direct hit to the default
"free large-context worker" value proposition. The strategic question for the
project is whether to (a) follow users to Antigravity CLI, (b) add a direct
Gemini-API backend path (a `GEMINI_API_KEY` mode, as API-wrapper rivals already
have), or (c) both. This is the most actionable finding in this briefing.

---

## 4. Competitive landscape

`gemini-mcp-tool` competes in a dense field that splits into three lanes.

**Lane A — API-wrapper Gemini servers** (call the Gemini API directly, require a
`GEMINI_API_KEY`):
- `aliargun/mcp-server-gemini` — MIT, ~255 stars, 6 tools (generation, image
  analysis, embeddings, token counting…), works with Claude Desktop/Cursor/Windsurf. **[H]**
- `bsmi021/mcp-gemini-server` — TypeScript over `@google/genai`, "Gemini as a
  backend workhorse," streaming + function calling + cached content. **[M]**
- Google's own **MCP Toolbox for Databases** (`googleapis/mcp-toolbox`) — official,
  but a different problem domain (DB access), not a general Gemini bridge. **[H]**

**Lane B — Multi-model orchestrators** (the dominant, fastest-growing rival shape):
- **`zen-mcp-server` → now `pal-mcp-server`** (BeehiveInnovations) — ~11.6k stars,
  Apache-2.0, "Claude Code + Gemini/OpenAI/Grok/Ollama working as one." Headline
  tools: `consensus` (blinded multi-model debate with stance steering), `chat`,
  `planner`, `thinkdeep`, `codereview`, plus **cross-model context continuity**.
  Supports Gemini 3.0 Pro/Flash among many providers. **[H]**
  ([pal-mcp-server](https://github.com/BeehiveInnovations/pal-mcp-server))

**Lane C — "AI council / second-opinion" bridges** (a crowded long tail):
`llm-council-mcp`, `ai-council-mcp`, `the-council` (Codex+Gemini for Claude),
`agent-council`, plus Claude↔Gemini-specific bridges (`zerubeus/gemini-claude-code-mcp`,
`centminmod/gemini-cli-mcp-server`, Roundtable MCP). **[H]**

**How `gemini-mcp-tool` is positioned.** Its differentiator is the **CLI-bridge +
large-context `@file` + free-tier token-saving** angle — *not* raw Gemini access,
which is now commoditized. Versus orchestrators it is deliberately narrow
(Gemini-only, tool-light) and lower-overhead; it does *not* do multi-model
consensus. That focus is a strength (simplicity, one-line install) and a ceiling
(the orchestrators are ~5× more starred and absorb the "council" demand).

---

## 5. Emerging adoption pattern: context economics & delegation

The unifying trend behind all of the above is **managing the agent's scarce context
window**, and it is driving real adoption.

- **The delegation pattern is now a named primitive.** When a user triggers a
  whole-codebase analysis in Claude Code, the MCP server ships the bulk to Gemini
  and streams back only the result — so Claude's context budget isn't spent on the
  raw read. **[H]**
  ([arsturn](https://www.arsturn.com/blog/how-to-use-gemini-1m-context-window-with-claude))

- **The technical motivation is a real window gap.** Gemini 2.5 Pro exposes a
  genuine 1M-token window with no special header; Claude's standard window is 200k
  (1M only in restricted beta). That ~5× gap, plus cheaper long-context pricing and
  a free CLI tier, is why developers delegate. **[H]/[M]**
  ([context comparison](https://www.morphllm.com/claude-context-window))

- **"Context rot" is the failure mode being designed around.** Practitioners report
  quality decline as windows fill; the remedy — delegate bulk reading to a fresh or
  external context and return only structured findings — is exactly what both
  subagents *and* Gemini-delegation MCP servers do. **[H]**
  ([context rot](https://www.mindstudio.ai/blog/context-rot-ai-coding-agents-sub-agents-fix))

- **Division of labor by model strength** is an emerging heuristic: Gemini's huge
  window for whole-repo planning/architecture, Claude for implementation/debugging
  ("Claude drafts, Gemini reviews"). **[M]**

- **Honest counter-trend:** MCP servers *also* consume context (a standard toolset
  reportedly ate >20% of the window before any work), which is why Claude Code added
  tool search/discovery. And there is **no rigorous independent benchmark** quantifying
  actual token/cost savings from Claude→Gemini delegation — that evidence gap is
  itself a finding. **[M]**

---

## 6. Security as a maturity signal

MCP's growth brought a security reckoning, and `gemini-mcp-tool` is part of it.

- **Project-specific:** **CVE-2026-0755 (CWE-78, CVSS 9.8)** — a command-injection
  RCE in the tool's `execAsync` path (unsanitized user input → shell), reachable via
  crafted `@file` references, affecting `>=1.1.2, <1.1.6`. Fixed in **v1.1.6**
  (2026-05-30) via `assertSafeFileReferences()` blocking path traversal/exfiltration;
  a related path-traversal fix (CWE-22) landed in v1.1.5. Tracked by ZDI (ZDI-26-021),
  NVD, and Snyk. **[H]**
  ([SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2026-0755/) ·
  [Snyk](https://security.snyk.io/vuln/SNYK-JS-GEMINIMCPTOOL-15091895) ·
  [v1.1.6 release](https://github.com/jamubc/gemini-mcp-tool/releases/tag/v1.1.6))

- **Ecosystem-wide:** "Tool poisoning" (hidden instructions in tool
  descriptions/metadata) is now a recognized MCP vulnerability class, with landmark
  CVEs **MCPoison (CVE-2025-54136)** and **CurXecute (CVE-2025-54135)**; OWASP ranks
  prompt injection #1 in its 2025 LLM Top 10; Simon Willison flagged MCP's inherent
  prompt-injection exposure as early as April 2025. **[H]**
  ([TrueFoundry](https://www.truefoundry.com/blog/blog-mcp-tool-poisoning-gateway-defense) ·
  [Willison](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/))

**Takeaway:** for an MCP server that bridges agent output into a shell, input
sanitization and workspace-trust are now table stakes. The rapid v1.1.5–v1.1.7
response is a positive signal; continued hardening is a competitive necessity.

---

## 7. Strategic implications & opportunities

Ranked by leverage:

1. **De-risk the substrate (highest priority).** Plan for the June 18, 2026 Gemini
   CLI individual-tier cutoff: support Antigravity CLI and/or add a direct
   **Gemini-API backend** (`GEMINI_API_KEY`) so the tool survives the CLI's
   free-tier sunset. This protects the core value proposition.
2. **Lean into the registry + remote-server trend.** Publish to the official MCP
   Registry and consider a streamable-HTTP/remote deployment mode to ride
   discovery and hosted-agent adoption.
3. **Differentiate on context economics, with evidence.** The tool's clearest moat
   is "save the orchestrator's tokens on large reads." Ship a documented, measurable
   token-savings story (the independent-benchmark gap is an opening, not just a risk).
4. **Decide whether to stay narrow or add light consensus.** Orchestrators own the
   multi-model "council" demand; a minimal `second-opinion`/`consensus` affordance
   could capture spillover without becoming a full zen/pal competitor — or doubling
   down on simplicity may remain the better wedge.
5. **Keep security velocity high.** Post-CVE, treat input sanitization, path
   confinement, and workspace-trust as ongoing roadmap items, not one-offs.

---

## Confidence & caveats

- **Strongest (multi-source / primary):** MCP cross-vendor adoption and spec
  timeline; the Gemini CLI → Antigravity CLI transition and June 18, 2026 cutoff;
  CVE-2026-0755 and its fix; the existence and relative scale of orchestrator rivals.
- **Directional (treat as moving averages):** npm download counts (~1k/week), star
  counts, MCP directory totals, model pricing/benchmark figures, SDK-download scale.
- **Known gaps:** several primary pages (Google blogs, npm, Snyk, Glama) returned
  HTTP 403 to automated fetching, so some figures rest on search snippets; no
  rigorous independent benchmark of Claude→Gemini delegation savings was found;
  free-tier "Gemini 2.5 Pro at 1,000/day" holds in principle but degrades to Flash
  under load per user reports. Re-verify any load-bearing number before acting on it.

---

## Sources

- gemini-mcp-tool: [GitHub](https://github.com/jamubc/gemini-mcp-tool) ·
  [releases](https://github.com/jamubc/gemini-mcp-tool/releases) ·
  [Smithery](https://smithery.ai/server/@jamubc/gemini-mcp-tool) ·
  [Glama](https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool)
- MCP protocol: [Anthropic announcement](https://www.anthropic.com/news/model-context-protocol) ·
  [Registry preview](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/) ·
  [First-anniversary post](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) ·
  [MCP Apps](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/) ·
  [2025-06-18 auth spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- Google services MCP support: [Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services)
- Gemini CLI: [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-cli-open-source-ai-agent/) ·
  [GitHub](https://github.com/google-gemini/gemini-cli) ·
  [MCP server docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)
- Antigravity transition: [Google Developers Blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) ·
  [The Register](https://www.theregister.com/ai-ml/2026/05/20/bye-bye-gemini-cli-google-nudges-devs-toward-antigravity/5243605) ·
  [GitHub Discussion #27274](https://github.com/google-gemini/gemini-cli/discussions/27274)
- Orchestrators / bridges: [pal-mcp-server (formerly zen)](https://github.com/BeehiveInnovations/pal-mcp-server) ·
  [mcp-server-gemini](https://github.com/aliargun/mcp-server-gemini) ·
  [Roundtable/council thread](https://news.ycombinator.com/item?id=45374908)
- Context economics: [arsturn](https://www.arsturn.com/blog/how-to-use-gemini-1m-context-window-with-claude) ·
  [context window comparison](https://www.morphllm.com/claude-context-window) ·
  [context rot](https://www.mindstudio.ai/blog/context-rot-ai-coding-agents-sub-agents-fix)
- Security: [CVE-2026-0755 (SentinelOne)](https://www.sentinelone.com/vulnerability-database/cve-2026-0755/) ·
  [Snyk advisory](https://security.snyk.io/vuln/SNYK-JS-GEMINIMCPTOOL-15091895) ·
  [tool poisoning](https://www.truefoundry.com/blog/blog-mcp-tool-poisoning-gateway-defense) ·
  [Willison on MCP prompt injection](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/)

*This document is research/analysis, not an official statement of the project. Figures are point-in-time (2026-06-05) and should be re-verified before being relied upon.*
