import type { Prisma, Session } from '@prisma/client'

export interface ISessionRepository {
  findByUserId(userId: string): Promise<Session[]>
  findByIdAndUser(id: string, userId: string): Promise<Session | null>
  findById(id: string): Promise<Session | null>
  create(data: Prisma.SessionUncheckedCreateInput): Promise<Session>
  update(id: string, data: Prisma.SessionUncheckedUpdateInput): Promise<Session>
  delete(id: string): Promise<Session>
}
