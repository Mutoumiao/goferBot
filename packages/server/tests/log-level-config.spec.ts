import { describe, expect, it } from 'vitest'
import { logLevelToNestLevels } from '../src/bootstrap.js'

describe('日志级别配置 (logLevelToNestLevels)', () => {
  it('debug 级别应包含所有日志级别', () => {
    const levels = logLevelToNestLevels('debug')
    expect(levels).toEqual(['log', 'error', 'warn', 'debug', 'verbose'])
  })

  it('info 级别应排除 debug 和 verbose', () => {
    const levels = logLevelToNestLevels('info')
    expect(levels).toEqual(['log', 'error', 'warn'])
  })

  it('warn 级别应只包含 warn 和 error', () => {
    const levels = logLevelToNestLevels('warn')
    expect(levels).toEqual(['error', 'warn'])
  })

  it('error 级别应只包含 error', () => {
    const levels = logLevelToNestLevels('error')
    expect(levels).toEqual(['error'])
  })

  it('无效级别应回退到 info', () => {
    const levels = logLevelToNestLevels('invalid')
    expect(levels).toEqual(['log', 'error', 'warn'])
  })
})
