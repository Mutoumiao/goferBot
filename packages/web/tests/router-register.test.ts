import { describe, expect, it } from 'vitest'
import { isRouteActive, ROUTES_REGISTER } from '@/router-register'

describe('isRouteActive (Icon Rail)', () => {
  it('matches chats prefix including nested query-less path', () => {
    const meta = ROUTES_REGISTER.chats
    expect(isRouteActive(meta, '/chats')).toBe(true)
    expect(isRouteActive(meta, '/chats/')).toBe(true)
    expect(isRouteActive(meta, '/knowledgeBase')).toBe(false)
  })

  it('matches knowledgeBase only on its prefix', () => {
    const meta = ROUTES_REGISTER.knowledgeBase
    expect(isRouteActive(meta, '/knowledgeBase')).toBe(true)
    expect(isRouteActive(meta, '/chats')).toBe(false)
  })

  it('matches companion primary path (and prefix if any stale URL)', () => {
    const meta = ROUTES_REGISTER.companion
    expect(isRouteActive(meta, '/companions')).toBe(true)
    expect(isRouteActive(meta, '/companions/')).toBe(true)
    // matchPrefixes 仍覆盖 /companions*，但产品不再注册二级 file route
    expect(isRouteActive(meta, '/chats')).toBe(false)
  })

  it('does not register companion secondary route metas', () => {
    expect(ROUTES_REGISTER).not.toHaveProperty('companionChat')
    expect(ROUTES_REGISTER).not.toHaveProperty('companionMemories')
  })

  it('matches settings only on settings path; profile is independent', () => {
    const meta = ROUTES_REGISTER.settings
    expect(isRouteActive(meta, '/settings')).toBe(true)
    expect(isRouteActive(meta, '/profile')).toBe(false)
    expect(isRouteActive(ROUTES_REGISTER.profile, '/profile')).toBe(true)
    expect(isRouteActive(meta, '/recycle')).toBe(false)
  })

  it('matches recycle', () => {
    expect(isRouteActive(ROUTES_REGISTER.recycle, '/recycle')).toBe(true)
    expect(isRouteActive(ROUTES_REGISTER.recycle, '/settings')).toBe(false)
  })
})

describe('ROUTES_REGISTER shell contract', () => {
  it('primary rail routes have keepAlive', () => {
    expect(ROUTES_REGISTER.chats.keepAlive).toBe(true)
    expect(ROUTES_REGISTER.knowledgeBase.keepAlive).toBe(true)
    expect(ROUTES_REGISTER.companion.keepAlive).toBe(true)
    expect(ROUTES_REGISTER.settings.keepAlive).toBe(true)
    expect(ROUTES_REGISTER.recycle.keepAlive).toBe(true)
  })

  it('login is not in rail and not keepAlive', () => {
    expect(ROUTES_REGISTER.login.navSection).toBeNull()
    expect('keepAlive' in ROUTES_REGISTER.login && ROUTES_REGISTER.login.keepAlive).toBeFalsy()
  })

  it('primary nav contains chats / knowledgeBase / companion（profile 走头像）', () => {
    const primary = Object.values(ROUTES_REGISTER)
      .filter((m) => m.navSection === 'primary')
      .map((m) => m.key)
      .sort()
    expect(primary).toEqual(['chats', 'companion', 'knowledgeBase'].sort())
    expect(ROUTES_REGISTER.profile.navSection).toBeNull()
  })

  it('secondary nav contains settings / recycle', () => {
    const secondary = Object.values(ROUTES_REGISTER)
      .filter((m) => m.navSection === 'secondary')
      .map((m) => m.key)
      .sort()
    expect(secondary).toEqual(['recycle', 'settings'].sort())
  })
})
