# How It Works

## Natural Language Workflow Integration

The gemini-mcp-tool is designed to seamlessly integrate into your natural workflow with your preferred MCP compliant AI clients, achieved through carefully crafted tools and pipelines.

Claude automatically decides when to use Gemini tools based on context:

**`ask-gemini` for Analysis & Review:**
- `🔍 comparative analysis` - different AI perspectives for validation
- `🛠️ leveraging extra tools` - Gemini's search and memory functions  
- `📋 code review & big changes` - second opinions on implementation
- `📚 large file analysis` - leveraging Gemini's massive token window

**`brainstorm` for Creative Ideation:**
- `💡 structured idea generation` - using proven creative methodologies
- `🎯 context-aware brainstorming` - domain-specific insights and constraints
- `⚡ rapid ideation` - quick creative sessions with progress tracking
- `🔄 iterative refinement` - building on previous brainstorming sessions

This intelligent tool selection enhances your workflow exactly when each AI's specialized capabilities add value.

<div align="center">⇣ when ask-gemini gets called ↴</div>
<DiagramModal>

```mermaid
---
config:
  flowchart:
    htmlLabels: false
    curve: cardinal
---
flowchart LR
    subgraph main
        direction TB
        A[You] --> |"ask gemini..."| B([**Claude**])
        B -..-> |"invokes 'ask-gemini'"| C["Gemini-MCP-Tool"]
        C --> |"spawn!"| D[Gemini-CLI]
        D e1@-.-> |"response"| C
        C -.-> |"response"| B
        B -.-> |"summary response"| A
        e1@{ animate: true }
    end
    subgraph Project
        B --> |"edits"| E["`**@*Files***`"]
        D -.-> |"reads"| E
    end
    classDef userNode fill:#1a237e,stroke:#fff,color:#fff,stroke-width:2px
    classDef claudeNode fill:#e64100,stroke:#fff,color:#fff,stroke-width:2px
    classDef geminiNode fill:#4285f4,stroke:#fff,color:#fff,stroke-width:2px
    classDef mcpNode fill:#37474f,stroke:#fff,color:#fff,stroke-width:2px
    classDef dataNode fill:#1b5e20,stroke:#fff,color:#fff,stroke-width:2px
    class A userNode
    class B claudeNode
    class C mcpNode
    class D geminiNode
    class E dataNode
```
</DiagramModal>
