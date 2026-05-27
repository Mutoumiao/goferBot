import type { RetrievalCandidate } from '../types.js'

export function reciprocalRankFusion(
  results: RetrievalCandidate[][],
  k: number = 60,
): RetrievalCandidate[] {
  const scores = new Map<string, { score: number; candidate: RetrievalCandidate }>()

  for (const list of results) {
    const sorted = [...list].sort((a, b) => b.score - a.score)
    for (let rank = 0; rank < sorted.length; rank++) {
      const candidate = sorted[rank]
      const rrfScore = 1 / (k + rank + 1)
      const existing = scores.get(candidate.chunk.id)
      if (existing) {
        existing.score += rrfScore
      } else {
        scores.set(candidate.chunk.id, { score: rrfScore, candidate })
      }
    }
  }

  const fused = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ score, candidate }) => ({
      ...candidate,
      score,
      source: 'hybrid' as const,
    }))

  return fused
}
