export interface SelectionTraceStep {
  operation: 'filter' | 'rerank' | 'budget-trim' | 'max-chunks-trim'
  reason: string
  droppedCount: number
}

export interface SelectionTrace {
  initialCount: number
  afterFilter: number
  afterRerank: number
  afterBudgetTrim: number
  afterMaxChunksTrim: number
  finalCount: number
  steps: SelectionTraceStep[]
}
