import { prisma } from './setup.js'

export async function cleanupTestData(): Promise<void> {
  await prisma.$executeRaw`DELETE FROM chunks WHERE kb_id LIKE 'q21-%'`
  await prisma.$executeRaw`DELETE FROM documents WHERE kb_id LIKE 'q21-%'`
  await prisma.$executeRaw`DELETE FROM knowledge_bases WHERE name LIKE 'Q21-%'`
  await prisma.$executeRaw`DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE title LIKE 'Q21-%')`
  await prisma.$executeRaw`DELETE FROM sessions WHERE title LIKE 'Q21-%'`
  await prisma.$executeRaw`DELETE FROM users WHERE email = 'q21-test@gofer.bot'`
}
