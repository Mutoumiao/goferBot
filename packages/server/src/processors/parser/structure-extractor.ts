/**
 * StructureExtractor —— 从纯文本中提取结构化信息
 *
 *   这是"结构提取"步骤的核心。输入是一段原始文本，输出是：
 *     - 文档标题（首个 H1）
 *     - 章节列表（带层级）
 *     - 代码块
 *     - 扁平化的层级路径（如 ["React18", "并发渲染"]）
 *
 *   ponytail: 当前仅支持 Markdown 语法识别。若后续需要 org-mode / rst，
 *   再扩展分词器；不要为"未来可能的格式"提前抽象策略类。
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
   * @param _filename 文件名（可选，保留参数位以便后续按扩展名切换规则；当前未使用）
   */
  extract(text: string, _filename?: string): ExtractedStructure {
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
    // ponytail: hierarchyTitles 作为"全量标题序列"，而非"当前路径栈"。
    // 同级兄弟都会保留，以便每个 section 能拿到完整的文档路径用于 Contextual Embedding。
    // 这比维护多棵兄弟树更简单，且满足 embedding 需求。
    const hierarchyTitles: string[] = []
    // headingStack 仅用于层级比较（栈顶同级或更深 → 弹出），不参与结果输出
    const headingLevels: number[] = []

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
      // 清理同级或更深层级（同级替换旧兄弟，更深清空后代）
      while (headingLevels.length > 0 && headingLevels[headingLevels.length - 1] >= level) {
        headingLevels.pop()
      }
      headingLevels.push(level)
      hierarchyTitles.push(title)
    }

    for (const line of lines) {
      // 代码块处理
      const fenceMatch = line.match(MD_CODE_FENCE_RE)
      if (fenceMatch) {
        if (!inCodeFence) {
          inCodeFence = true
          codeLanguage = fenceMatch[1]?.trim() || 'plaintext'
          codeLines = []
          flushSection()
          currentHeading = undefined
          currentLevel = 0
          currentContentLines = []
          continue
        } else {
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

    flushSection()

    // hierarchyTitles 保留所有遇到的标题（含同级兄弟），
    // 作为全量层级路径供 Contextual Embedding 使用。
    return {
      title: docTitle,
      hierarchyPath: hierarchyTitles,
      sections,
      codeBlocks,
    }
  }
}
