import { describe, it, expect } from 'vitest'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('AuthFixtures', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-03: createUser returns valid user via HTTP', async () => {
    const dbUrl = await dbManager.createDatabase('authfixtures')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: 'fixture@gofer.bot',
      password: 'Test1234!',
      name: 'Fixture',
    })
    expect(user.email).toBe('fixture@gofer.bot')
    expect(user.name).toBe('Fixture')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-03: loginAs returns valid JWT token', async () => {
    const dbUrl = await dbManager.createDatabase('authfixtures2')
    const app = await TestAppFactory.create(dbUrl)

    await AuthFixtures.createUser(app, {
      email: 'login@gofer.bot',
      password: 'Test1234!',
      name: 'Login',
    })
    const token = await AuthFixtures.loginAs(app, {
      email: 'login@gofer.bot',
      password: 'Test1234!',
    })
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })
})
