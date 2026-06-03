import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { hash, compare } from 'bcrypt'
import { PrismaService } from '../../processors/database/prisma.service.js'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    })
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async create(email: string, password: string, name?: string) {
    const existing = await this.findByEmail(email)
    if (existing) {
      throw new ConflictException({
        code: 'USER_EXISTS',
        message: '该邮箱已被注册',
      })
    }

    return this.prisma.user.create({
      data: {
        email,
        password: await hash(password, 12),
        name: name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async validatePassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new NotFoundException({
        code: 'AUTH_FAIL',
        message: '邮箱或密码错误',
      })
    }

    const isValid = await compare(password, user.password)
    if (!isValid) {
      throw new NotFoundException({
        code: 'AUTH_FAIL',
        message: '邮箱或密码错误',
      })
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
