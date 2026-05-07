import * as fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export function getAppDataDir(): string {
  const base = process.env.APP_DATA_DIR ?? os.homedir()
  const dir = path.join(base, 'knowledge-base')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}
