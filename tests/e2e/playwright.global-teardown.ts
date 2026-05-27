import { execSync } from 'child_process'

export default async function globalTeardown() {
  if (process.env.CI) {
    console.log('[E2E] CI mode: shutting down docker infrastructure...')
    execSync('pnpm infra:down', { stdio: 'inherit' })
  } else {
    console.log('[E2E] Local mode: keeping docker running for reuse')
  }
}
