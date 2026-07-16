import { buildDefaultAgentPrompt, type PersonaPromptFields } from './build-default-agent-prompt.js'

/** 全局安全配置皆空时的最小中文兜底（user 源） */
export const COMPANION_DEFAULT_GUARDRAILS =
  '遵守法律法规与公序良俗；不提供危险、违法或伤害性指导；尊重用户边界；避免性剥削与未成年人相关不当内容；遇到危机时建议寻求现实专业帮助。'

export type CompanionSourceKind = 'system' | 'user'

export interface CompanionPersonaRow extends PersonaPromptFields {
  source: CompanionSourceKind
}

export interface CompanionGlobalSafetySettings {
  defaultBoundaries?: string | null
  defaultGuardrailsPrompt?: string | null
}

/**
 * 按 source 解析人设全文（含安全节权威）：
 * - system：行内 boundaries / guardrailsPrompt
 * - user：当前全局配置，皆空则代码兜底
 */
export function resolvePersonaPrompt(
  companion: CompanionPersonaRow,
  globalSettings?: CompanionGlobalSafetySettings | null,
): string {
  const safety =
    companion.source === 'system'
      ? {
          boundaries: companion.boundaries,
          guardrailsPrompt: companion.guardrailsPrompt,
        }
      : resolveUserSafety(globalSettings)

  return buildDefaultAgentPrompt({
    name: companion.name,
    headline: companion.headline,
    description: companion.description,
    backgroundStory: companion.backgroundStory,
    personality: companion.personality,
    tone: companion.tone,
    boundaries: safety.boundaries,
    guardrailsPrompt: safety.guardrailsPrompt,
    openingMessage: companion.openingMessage,
  })
}

export function resolveUserSafety(globalSettings?: CompanionGlobalSafetySettings | null): {
  boundaries: string
  guardrailsPrompt: string
} {
  const boundaries = globalSettings?.defaultBoundaries?.trim() ?? ''
  const guardrailsPrompt = globalSettings?.defaultGuardrailsPrompt?.trim() ?? ''
  if (!boundaries && !guardrailsPrompt) {
    return { boundaries: '', guardrailsPrompt: COMPANION_DEFAULT_GUARDRAILS }
  }
  return { boundaries, guardrailsPrompt }
}
