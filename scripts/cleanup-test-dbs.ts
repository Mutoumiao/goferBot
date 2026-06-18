/**
 * 一次性清理历史残留测试数据库脚本。
 *
 * 用法（在仓库根目录执行）：
 *   pnpm tsx scripts/cleanup-test-dbs.ts                 # 列出并交互式清理全部 goferbot_test_*
 *   pnpm tsx scripts/cleanup-test-dbs.ts --older-than 2   # 只清理创建超过 2 小时的
 *   pnpm tsx scripts/cleanup-test-dbs.ts --dry-run        # 只列出将要清理的，不真正 drop
 *
 * 依赖环境变量：TEST_DATABASE_ADMIN_URL（与测试使用的一致）。
 */
import { Client } from 'pg'
import { parseCreatedAtFromName } from '../tests/integration/helpers/test-database.manager.js'

const DB_PREFIX = 'goferbot_test_'

interface CliOpts {
  dryRun: boolean
  olderThanHours: number
  yes: boolean
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = { dryRun: false, olderThanHours: 0, yes: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--yes' || arg === '-y') opts.yes = true
    else if (arg === '--older-than' && argv[i + 1]) {
      const n = Number(argv[++i])
      if (Number.isFinite(n) && n >= 0) opts.olderThanHours = n
    }
  }
  return opts
}

async function listOrphaned(url: string): Promise<string[]> {
  const client = new Client({ connectionString: url })
  try {
    await client.connect()
    const res = await client.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE $1`,
      [`${DB_PREFIX}%`],
    )
    return res.rows.map((r) => r.datname)
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function listActive(url: string): Promise<Set<string>> {
  const client = new Client({ connectionString: url })
  try {
    await client.connect()
    const res = await client.query<{ datname: string }>(
      `SELECT DISTINCT d.datname
         FROM pg_database d
         JOIN pg_stat_activity a ON a.datname = d.datname
        WHERE d.datname LIKE $1`,
      [`${DB_PREFIX}%`],
    )
    return new Set(res.rows.map((r) => r.datname))
  } finally {
    await client.end().catch(() => undefined)
  }
}

function humanAge(ts: number | null): string {
  if (ts == null) return 'unknown-age'
  const diff = Date.now() - ts
  if (diff < 0) return 'from-future'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m old`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h old`
  const days = Math.floor(hours / 24)
  return `${days}d old`
}

async function main(): Promise<void> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL
  if (!adminUrl) {
    console.error('ERROR: TEST_DATABASE_ADMIN_URL is not set.')
    process.exit(1)
  }

  const opts = parseArgs(process.argv.slice(2))

  console.log(`Connecting to ${new URL(adminUrl).host} …`)

  const [orphans, active] = await Promise.all([listOrphaned(adminUrl), listActive(adminUrl)])

  if (orphans.length === 0) {
    console.log('No goferbot_test_* databases found.')
    return
  }

  const candidates = orphans
    .map((name) => {
      const createdAt = parseCreatedAtFromName(name)
      const age = humanAge(createdAt)
      const isActive = active.has(name)
      const tooYoung =
        opts.olderThanHours > 0 &&
        createdAt != null &&
        Date.now() - createdAt < opts.olderThanHours * 3600 * 1000
      return { name, createdAt, age, isActive, tooYoung }
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))

  console.log(`\nFound ${candidates.length} test database(s):\n`)
  candidates.forEach((c) => {
    const flags: string[] = []
    if (c.isActive) flags.push('ACTIVE')
    if (c.tooYoung) flags.push(`<${opts.olderThanHours}h`)
    const flagStr = flags.length ? `  [${flags.join(', ')}]` : ''
    console.log(`  ${c.name}  (${c.age})${flagStr}`)
  })

  const toDrop = candidates.filter((c) => !c.isActive && !c.tooYoung)
  const toSkip = candidates.filter((c) => c.isActive || c.tooYoung)

  if (toDrop.length === 0) {
    console.log('\nNothing to drop (everything is either active or filtered out).')
    return
  }

  console.log(
    `\nWill ${opts.dryRun ? '[DRY-RUN] list' : 'DROP'} ${toDrop.length} database(s); will skip ${toSkip.length}.`,
  )

  if (opts.dryRun) return

  if (!opts.yes) {
    const readline = await import('node:readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const answer = await new Promise<string>((resolve) =>
      rl.question('\nProceed? [y/N] ', (a) => resolve(a.trim().toLowerCase())),
    )
    rl.close()
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Aborted.')
      return
    }
  }

  const client = new Client({ connectionString: adminUrl })
  const dropped: string[] = []
  const failed: string[] = []
  try {
    await client.connect()
    for (const c of toDrop) {
      try {
        await client.query(`DROP DATABASE IF EXISTS "${c.name}" WITH (FORCE)`)
        dropped.push(c.name)
        console.log(`  dropped  ${c.name}`)
      } catch (err) {
        failed.push(`${c.name}: ${(err as Error).message}`)
        console.log(`  FAILED  ${c.name}  (${(err as Error).message})`)
      }
    }
  } finally {
    await client.end().catch(() => undefined)
  }

  console.log(`\nDone: dropped ${dropped.length}, failed ${failed.length}.`)
  if (failed.length > 0) {
    console.log('\nFailed databases (check if they are still in use):')
    for (const f of failed) console.log(`  - ${f}`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
