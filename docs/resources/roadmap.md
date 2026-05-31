# Roadmap

<div style="text-align: center;">

## Evolution

</div>

<DiagramModal>

```mermaid
---
config:
  flowchart:
    htmlLabels: false
    curve: cardinal
---
flowchart LR
    A["v1.1.1
    Basic Integration"] --> B["v1.1.2
    Auto-Fallback"]
    B --> C["v1.1.3
    Claude Edits, Gemini Reads"]
    C --> D["v1.1.5
    Security Fixes"]
    D --> E["v1.1.6
    CVE-2026-0755"]
    E --> F["v1.2.0
    Backends + Sessions"]
    
    classDef releasedNode fill:#1b5e20,stroke:#fff,color:#fff,stroke-width:2px
    classDef currentNode fill:#e64100,stroke:#fff,color:#fff,stroke-width:2px
    
    class A,B,C,D,E releasedNode
    class F currentNode
```
</DiagramModal>

<div style="text-align: center;">

## Timeline

</div>

<DiagramModal>

```mermaid
---
config:
  timeline:
    htmlLabels: false
  theme: dark
---
timeline
    title Gemini MCP Tool Evolution
    
    section 2025
        v1.1.0-v1.1.3  : Claude uses Gemini!
                        : Sandbox Mode, Fallback
                        : Change Mode
                        
    section May 2026
        v1.1.5-v1.1.6  : Security Patches
                        : CVE-2026-0755
                        : CWE-22 path traversal
        
        v1.2.0 Release  : Pluggable Backends
                        : Approval Mode
                        : Native Sessions
                        : Per-call Timeout
                        : Windows Reliability
                        : Test Suite
                       
    section Next
        v1.3.0 Planned  : Streaming output
                        : output-format support
                        : Full agy backend
```
</DiagramModal>

## What's Next

### v1.3.0 (Planned)
- **Streaming output** — `--output-format stream-json` for real-time progress
- **Full agy backend** — once the `agy -p` stdout bug is fixed upstream
- **ACP persistent process** — reuse a long-lived agy process for performance

### Open PRs (separate merges)
- **#65** — MCP SDK modernization + OAuth
- **#44** — LRU cache for performance
- **#46** — Tool annotations
- **#50** — Native session-id resume (partially landed in 1.2.0)
- **#35** — Gemini schema compatibility