import { getPublicKey } from '@/api/auth'

let cachedPublicKey: CryptoKey | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 30 * 1000

function isCacheExpired(): boolean {
  return cacheTimestamp === 0 || Date.now() - cacheTimestamp > CACHE_TTL_MS
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function fetchPublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey && !isCacheExpired()) {
    return cachedPublicKey
  }
  try {
    const data = await getPublicKey().send()
    const buffer = pemToArrayBuffer(data.publicKey)
    cachedPublicKey = await crypto.subtle.importKey(
      'spki',
      buffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    )
    cacheTimestamp = Date.now()
    return cachedPublicKey
  } catch (e) {
    if (e instanceof PasswordEncryptionError) throw e
    throw new PasswordEncryptionError('密码加密失败，请刷新页面后重试')
  }
}

export class PasswordEncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PasswordEncryptionError'
  }
}

export async function encryptPassword(password: string): Promise<string> {
  try {
    const publicKey = await fetchPublicKey()
    const encoded = new TextEncoder().encode(password)
    const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, encoded)
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  } catch (e) {
    if (e instanceof PasswordEncryptionError) throw e
    throw new PasswordEncryptionError('密码加密失败，请刷新页面后重试')
  }
}

export function clearPublicKeyCache(): void {
  cachedPublicKey = null
}
