import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('RAG SDK Coverage', () => {
  it('AC-03: core logic coverage meets threshold', () => {
    const coveragePath = path.resolve('coverage/coverage-summary.json')
    if (!fs.existsSync(coveragePath)) {
      throw new Error('Coverage report not found. Run: npx vitest run --coverage')
    }

    const summary = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'))
    const ragSdkPath = 'packages/rag-sdk/src/'

    let totalLines = 0
    let coveredLines = 0

    for (const [file, data] of Object.entries(summary)) {
      // 兼容 Windows 绝对路径和 Unix 相对路径
      const normalizedFile = file.replace(/\\/g, '/')
      if ((normalizedFile.startsWith(ragSdkPath) || normalizedFile.includes('/packages/rag-sdk/src/')) && !normalizedFile.includes('index.ts')) {
        const d = data as { lines: { total: number; covered: number } }
        totalLines += d.lines.total
        coveredLines += d.lines.covered
      }
    }

    const coverage = totalLines === 0 ? 0 : (coveredLines / totalLines) * 100
    expect(coverage).toBeGreaterThanOrEqual(80)
  })
})
