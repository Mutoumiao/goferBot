import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      email: 'seed@goferbot.local',
      name: 'Seed User',
      password: '$2b$10$seed_password_hash_placeholder',
    },
  });

  await prisma.knowledgeBase.create({
    data: {
      userId: user.id,
      name: '示例知识库',
      description: '由 seed 脚本创建的示例知识库',
    },
  });

  console.log('Seed completed:', user.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
