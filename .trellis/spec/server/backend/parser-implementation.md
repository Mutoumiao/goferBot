# Parser Implementation Guide

> 文档解析器策略模式架构、PDF 三引擎后备链、结构提取器实现细节
>
> **REFERENCE_ONLY**: 此文件记录实现细节（HOW）。功能规范权威源为 [openspec/specs/document/spec.md](../../../../openspec/specs/document/spec.md)（WHAT）。解析器行为/结构提取/MIME映射应以 OpenSpec 为准。

---

## Strategy Pattern Architecture

```
                 ┌──────────────────────┐
                 │    DocumentParser     │  ← Dispatcher (Injectable)
                 │  parsers: Map<name,   │
                 │    IDocumentParser>   │
                 │  mimeIndex: Map<mime, │
                 │    IDocumentParser>   │
                 └──────┬───────────────┘
                        │ register / unregister
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼ (extensible)
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │TextParser│ │ PdfParser│ │ CustomParser │
    │ 4 mimes  │ │ 1 mime   │ │ (user-defined│
    └──────────┘ └──────────┘ └──────────────┘
```

### IDocumentParser Interface

```typescript
// parser.types.ts
interface IDocumentParser {
  readonly name: string
  readonly mimeTypes: string[]
  parse(input: ParserInput): Promise<ParseResult>
}

interface ParserInput {
  filename?: string
  mimeType: string
  buffer?: Buffer
  filePath?: string
}

interface ParseResult {
  content: string
  title?: string
  hierarchyPath?: string[]
  sections: SectionBlock[]
  codeBlocks?: CodeBlock[]
  metadata?: Record<string, unknown>
}
```

### Default Parsers

| Parser | MIME Types | Implementation |
|--------|-----------|----------------|
| `TextParser` | text/plain, text/markdown, text/x-markdown, text/html | Buffer→UTF-8 + StructureExtractor |
| `PdfParser` | application/pdf | Triple fallback chain |

## PDF Parser Triple Fallback Chain

```
PdfParser.extractText(input)
  │
  ├─ 1) resolveBackend() → try require('@llamaindex/readers') → if found: 'llamaindex'
  │                         catch → try require('pdf-parse') → if found: 'pdf-parse'
  │                         catch → return 'fallback'
  │
  ├─ 'llamaindex':
  │     require('@llamaindex/readers').PDFReader → reader.loadData(filePath) → docs.getContent()
  │     requires filePath input; falls back to raw buffer if filePath is undefined
  │     failure → downgrades to raw buffer
  │
  ├─ 'pdf-parse':
  │     require('pdf-parse')(buffer) → result.text
  │     requires buffer input
  │     failure → downgrades to raw buffer
  │
  └─ 'fallback':
        buffer.toString('utf-8')  ← only works for text-based PDFs; binary PDFs produce garbage
```

Each backend is loaded via `require()` (dynamic, not static import) to avoid hard dependency on PDF libraries.

## StructureExtractor (Pure Function)

### Input/Output

```
Input:  raw text (string)
Output: ExtractedStructure {
  title?: string            // first H1 heading
  hierarchyPath: string[]   // all encountered headings for Contextual Embedding
  sections: { heading?, level, content }[]
  codeBlocks: { language, content }[]
}
```

### Processing Algorithm

1. Split text into lines
2. Iterate lines with state machine:
   - **Code fence detection**: ` ```lang ` pattern → toggle `inCodeFence`; collect code lines until closing fence
   - **Heading detection**: `#~###### ` pattern → extract level + title; flush previous section; update `headingLevels` stack (pop equal/deeper levels, push new level)
   - **Body text**: accumulate into `currentContentLines`
3. Flush final section
4. Return structure

### Heading Level Stack Logic

- `headingLevels` is a stack of heading LEVELS (integers), not path
- When a new heading at level N is encountered:
  - Pop from stack while top >= N (sibling replacement + descendant cleanup)
  - Push N onto stack
- `hierarchyTitles` accumulates ALL heading titles (including siblings), not just the current path
- This is intentional: for Contextual Embedding, having the full heading sequence provides richer context than just the current path

### Code Block Preservation

- Code blocks are extracted BEFORE heading processing
- Text inside code fences is NEVER parsed for headings
- Code blocks are returned separately from sections

## Zod Validation Pipeline

```
parse(input) {
  1. parserInputSchema.parse(input)       ← validates buffer/filePath presence
  2. resolveParser(mimeType, filename)    ← strategy dispatch
  3. parser.parse(parsedInput)            ← delegated to specific parser
  4. parseResultSchema.parse(result)      ← validates output structure
  5. return result
}
```

If Zod validation fails at any step, the error is caught by the IndexingWorker and the document is marked as `failed`.

## Extension-to-MIME Mapping

```typescript
// Hardcoded — no external mime-types library
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
}
```

Design rationale: only 6 formats needed in practice; adding a library for 6 entries is over-engineering. If the project needs 50+ formats, switch to `mime-types` at that point.
