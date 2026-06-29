import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.create({
    data: {
      email: 'seed@goferbot.local',
      name: 'Seed User',
      password: '$2b$10$seed_password_hash_placeholder',
    },
  })

  await prisma.knowledgeBase.create({
    data: {
      userId: user.id,
      name: '示例知识库',
      description: '由 seed 脚本创建的示例知识库',
    },
  })

  const adminApp = await prisma.application.create({
    data: {
      code: 'admin',
      name: 'GoferBot Admin',
      status: 'active',
    },
  })

  const webApp = await prisma.application.create({
    data: {
      code: 'web',
      name: 'GoferBot Web',
      status: 'active',
    },
  })

  await prisma.applicationAuthMethod.createMany({
    data: [
      { applicationId: adminApp.id, provider: 'password', enabled: true },
      { applicationId: adminApp.id, provider: 'github', enabled: false },
      { applicationId: webApp.id, provider: 'password', enabled: true },
      { applicationId: webApp.id, provider: 'github', enabled: true },
    ],
  })

  console.log('Seed completed:', user.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
