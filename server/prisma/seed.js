import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const systemCategories = [
  { name: '薪資', type: 'INCOME', sortOrder: 1 },
  { name: '獎金', type: 'INCOME', sortOrder: 2 },
  { name: '兼職', type: 'INCOME', sortOrder: 3 },
  { name: '其他收入', type: 'INCOME', sortOrder: 4 },
  { name: '飲食', type: 'EXPENSE', sortOrder: 1 },
  { name: '交通', type: 'EXPENSE', sortOrder: 2 },
  { name: '居住', type: 'EXPENSE', sortOrder: 3 },
  { name: '日用品', type: 'EXPENSE', sortOrder: 4 },
  { name: '醫療', type: 'EXPENSE', sortOrder: 5 },
  { name: '娛樂', type: 'EXPENSE', sortOrder: 6 },
  { name: '通訊', type: 'EXPENSE', sortOrder: 7 },
  { name: '教育', type: 'EXPENSE', sortOrder: 8 },
  { name: '其他支出', type: 'EXPENSE', sortOrder: 9 },
];

async function main() {
  console.log('Seeding system categories...');

  for (const cat of systemCategories) {
    await prisma.category.upsert({
      where: {
        id: `system-${cat.type.toLowerCase()}-${cat.sortOrder}`,
      },
      update: {
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
      create: {
        id: `system-${cat.type.toLowerCase()}-${cat.sortOrder}`,
        name: cat.name,
        type: cat.type,
        isSystem: true,
        sortOrder: cat.sortOrder,
        userId: null,
      },
    });
  }

  console.log(`Seeded ${systemCategories.length} system categories.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
