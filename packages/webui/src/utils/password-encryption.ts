import { api } from '@/api/client'

let cachedPublicKey: CryptoKey | null = null

interface PublicKeyResponse {
  publicKey: string
  algorithm: string
  hash: string
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
  if (cachedPublicKey) {
    return cachedPublicKey
  }
  const data = await api.get<PublicKeyResponse>('/api/auth/public-key')
  const buffer = pemToArrayBuffer(data.publicKey)
  cachedPublicKey = await crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  return cachedPublicKey
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
