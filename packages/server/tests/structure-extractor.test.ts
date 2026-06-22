/**
 * StructureExtractor 单元测试
 *
 * 新人可参考此文件了解结构提取器的输入/输出契约。
 */
import { describe, expect, it } from 'vitest'
import { StructureExtractor } from '../src/processors/parser/structure-extractor.js'

describe('StructureExtractor', () => {
  const extractor = new StructureExtractor()

  it('提取 Markdown 标题为文档标题和层级路径', async () => {
    const input = `# React18 新特性

## 并发渲染

内容 A

## Suspense

内容 B`

    const result = await extractor.extract(input, 'react18.md')

    expect(result.title).toBe('React18 新特性')
    expect(result.hierarchyPath).toEqual(['React18 新特性', '并发渲染', 'Suspense'])
    expect(result.sections.length).toBeGreaterThanOrEqual(2)
  })

  it('识别代码块', async () => {
    const input = `# 示例

下面是代码：

\`\`\`typescript
const x: number = 1
\`\`\``

    const result = await extractor.extract(input)

    expect(result.codeBlocks.length).toBe(1)
    expect(result.codeBlocks[0].language).toBe('typescript')
    expect(result.codeBlocks[0].content).toContain('const x: number = 1')
  })

  it('处理空文本', async () => {
    const result = await extractor.extract('')

    expect(result.title).toBeUndefined()
    expect(result.hierarchyPath).toEqual([])
    expect(result.sections).toEqual([])
    expect(result.codeBlocks).toEqual([])
  })

  it('支持纯文本（无标题）', async () => {
    const input = '这是一段普通文本，没有任何标题。'
    const result = await extractor.extract(input)

    expect(result.title).toBeUndefined()
    expect(result.sections.length).toBe(1)
    expect(result.sections[0].level).toBe(0)
  })

  it('识别深层级标题', async () => {
    const input = `# 顶级
## 二级
### 三级`

    const result = await extractor.extract(input)

    expect(result.hierarchyPath).toEqual(['顶级', '二级', '三级'])
  })
})
