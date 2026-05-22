import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'

loadEnvFile(resolve(import.meta.dirname, '../../.env'))
loadEnvFile(resolve(import.meta.dirname, '../../.env.test'))
loadEnvFile(resolve(import.meta.dirname, '../../packages/server/.env'))
