/**
 * 对齐 ai-partner-agent `buildDefaultAgentPrompt` / 前端 buildPreviewPrompt。
 * 固定章节顺序；空节省略（不写空洞标题堆）。
 */

export interface PersonaPromptFields {
  name?: string | null
  headline?: string | null
  description?: string | null
  backgroundStory?: string | null
  personality?: string | null
  tone?: string | null
  boundaries?: string | null
  guardrailsPrompt?: string | null
  openingMessage?: string | null
}

function section(title: string, body: string | null | undefined): string[] {
  const text = body?.trim()
  if (!text) return []
  return ['', `## ${title}`, text]
}

/**
 * 多节拼接 defaultPrompt。至少有 name 时生成角色声明。
 * 映射：headline→一句话设定；description→角色说明；backgroundStory→人物故事；
 * personality→性格与互动；tone→语气风格；boundaries+guardrailsPrompt→边界与安全；
 * openingMessage→默认开场（仅写入 prompt 全文，不替代运行时开场白触发）。
 */
export function buildDefaultAgentPrompt(fields: PersonaPromptFields): string {
  const name = fields.name?.trim() || '未命名角色'
  const parts: string[] = [`你现在扮演 AI 电子伴侣「${name}」。`]

  parts.push(...section('一句话设定', fields.headline))
  parts.push(...section('角色说明', fields.description))
  parts.push(...section('人物故事背景', fields.backgroundStory))
  parts.push(...section('性格与互动方式', fields.personality))
  parts.push(...section('语气风格', fields.tone))

  const boundaryBits = [fields.boundaries?.trim(), fields.guardrailsPrompt?.trim()]
    .filter(Boolean)
    .join('\n')
  parts.push(...section('边界与安全规则', boundaryBits || undefined))
  parts.push(...section('默认开场', fields.openingMessage))

  // 回复要求：固定轻量约束节（有人设时始终附带，保证非空结构）
  const hasPersonaBody =
    Boolean(fields.headline?.trim()) ||
    Boolean(fields.description?.trim()) ||
    Boolean(fields.backgroundStory?.trim()) ||
    Boolean(fields.personality?.trim()) ||
    Boolean(fields.tone?.trim()) ||
    Boolean(fields.boundaries?.trim()) ||
    Boolean(fields.guardrailsPrompt?.trim())

  if (hasPersonaBody || name !== '未命名角色') {
    parts.push(
      '',
      '## 回复要求',
      '用自然口语回复，像聊天软件里的朋友；先接住情绪再推进；不要长篇说教。',
    )
  }

  return parts.join('\n').trim()
}
