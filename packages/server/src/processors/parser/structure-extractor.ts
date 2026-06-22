/**
 * StructureExtractor —— 从纯文本中提取结构化信息
 *
 *   这是"结构提取"步骤的核心。输入是一段原始文本，输出是：
 *     - 文档标题（首个 H1）
 *     - 章节列表（带层级）
 *     - 代码块
 *     - 扁平化的层级路径（如 ["React18", "并发渲染"]）
 *
 *   目前支持 Markdown 语法识别。后续可扩展 org-mode / reStructuredText。
 *
 *   本类**无副作用**，可在任意环境（CLI、Web Worker、测试）中运行。
 */

export interface ExtractedStructure {
  title?: string
  hierarchyPath: string[]
  sections: Array<{ heading?: string; level: number; content: string }>
  codeBlocks: Array<{ language: string; content: string }>
}

/** Markdown 标题正则：# ~ ###### */
const MD_HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/

/** Markdown 代码块起始/结束：```lang */
const MD_CODE_FENCE_RE = /^```(\w*)\s*$/

export class StructureExtractor {
  /**
   * 从原始文本提取结构
   *
   * @param text 原始文本（Markdown / 纯文本）
   * @param _filename 文件名（可选，用于后续按扩展名切换规则）
   */
  async extract(text: string, _filename?: string): Promise<ExtractedStructure> {
    if (!text || text.trim().length === 0) {
      return { hierarchyPath: [], sections: [], codeBlocks: [] }
    }

    const lines = text.split(/\r?\n/)
    const sections: ExtractedStructure['sections'] = []
    const codeBlocks: ExtractedStructure['codeBlocks'] = []

    let currentHeading: string | undefined
    let currentLevel = 0
    let currentContentLines: string[] = []
    let inCodeFence = false
    let codeLanguage = ''
    let codeLines: string[] = []
    let docTitle: string | undefined
    const headingStack: Array<{ level: number; title: string }> = []
    const hierarchyTitles: string[] = []

    const flushSection = () => {
      const content = currentContentLines.join('\n').trim()
      if (content.length > 0 || currentHeading) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content,
        })
      }
    }

    const pushHeading = (level: number, title: string) => {
      // 栈维护当前路径（同级替换，更深清空）
      // hierarchyTitles 追加所有标题（保留兄弟节点的全量历史）
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop()
      }
      headingStack.push({ level, title })
      hierarchyTitles.push(title)
    }

    for (const line of lines) {
      // 代码块处理
      const fenceMatch = line.match(MD_CODE_FENCE_RE)
      if (fenceMatch) {
        if (!inCodeFence) {
          // 开启代码块
          inCodeFence = true
          codeLanguage = fenceMatch[1]?.trim() || 'plaintext'
          codeLines = []
          // 先 flush 当前 section
          flushSection()
          currentHeading = undefined
          currentLevel = 0
          currentContentLines = []
          continue
        } else {
          // 关闭代码块
          inCodeFence = false
          if (codeLines.length > 0) {
            codeBlocks.push({
              language: codeLanguage,
              content: codeLines.join('\n'),
            })
          }
          continue
        }
      }

      if (inCodeFence) {
        codeLines.push(line)
        continue
      }

      // 标题处理
      const headingMatch = line.match(MD_HEADING_RE)
      if (headingMatch) {
        // 遇到新标题，先 flush 当前 section
        flushSection()
        currentContentLines = []

        const level = headingMatch[1].length
        const title = headingMatch[2].trim()
        currentHeading = title
        currentLevel = level

        if (!docTitle && level === 1) {
          docTitle = title
        }
        pushHeading(level, title)
        continue
      }

      // 普通正文
      currentContentLines.push(line)
    }

    // 最后的 section
    flushSection()

    // hierarchyTitles 记录所有遇到的标题（包括同级兄弟），
    // headingStack 记录"当前路径"。这里用全量标题作为 hierarchyPath，
    // 以支持"文档标题 / 章节A / 章节B / 章节C"的完整结构。
    const hierarchyPath = hierarchyTitles

    return {
      title: docTitle,
      hierarchyPath,
      sections,
      codeBlocks,
    }
  }
}
