/**
 * 开场白触发：仅 messageCount===0（空列表）且 openingMessage 非空。
 */
export function shouldShowOpeningMessage(input: {
  messageCount: number
  openingMessage?: string | null
}): boolean {
  return input.messageCount === 0 && Boolean(input.openingMessage?.trim())
}

export function buildOpeningUiMessage(input: {
  conversationId: string | null
  companionId: string
  openingMessage: string
}): { id: string; role: 'assistant'; content: string } {
  const id = input.conversationId
    ? `opening-${input.conversationId}`
    : `opening-pending-${input.companionId}`
  return {
    id,
    role: 'assistant',
    content: input.openingMessage.trim(),
  }
}
