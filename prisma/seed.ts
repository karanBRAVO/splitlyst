import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

try {
  process.loadEnvFile('.env');
} catch {
  // .env not present — rely on environment variables already set
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create demo users
  const password = await bcrypt.hash('demo1234', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      password,
      currency: 'USD',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      password,
      currency: 'USD',
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: 'carol@example.com' },
    update: {},
    create: {
      email: 'carol@example.com',
      name: 'Carol Davis',
      password,
      currency: 'USD',
    },
  });

  // Create friendship
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: alice.id, userBId: bob.id } },
    update: {},
    create: { userAId: alice.id, userBId: bob.id, status: 'accepted' },
  });
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: alice.id, userBId: carol.id } },
    update: {},
    create: { userAId: alice.id, userBId: carol.id, status: 'accepted' },
  });

  // Create a group
  const group = await prisma.group.create({
    data: {
      name: 'Paris Trip 2024',
      description: 'Expenses from our Paris trip',
      currency: 'EUR',
      category: 'trip',
      members: {
        create: [
          { userId: alice.id, role: 'admin' },
          { userId: bob.id, role: 'member' },
          { userId: carol.id, role: 'member' },
        ],
      },
    },
  });

  // Create expenses
  const dinner = await prisma.expense.create({
    data: {
      description: 'Dinner at Le Jules Verne',
      amount: 180,
      currency: 'EUR',
      category: 'food',
      groupId: group.id,
      paidById: alice.id,
      splitType: 'equal',
      splits: {
        create: [
          { userId: alice.id, amount: 60 },
          { userId: bob.id, amount: 60 },
          { userId: carol.id, amount: 60 },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      description: 'Eiffel Tower tickets',
      amount: 75,
      currency: 'EUR',
      category: 'entertainment',
      groupId: group.id,
      paidById: bob.id,
      splitType: 'equal',
      splits: {
        create: [
          { userId: alice.id, amount: 25 },
          { userId: bob.id, amount: 25 },
          { userId: carol.id, amount: 25 },
        ],
      },
    },
  });

  await prisma.expense.create({
    data: {
      description: 'Hotel (3 nights)',
      amount: 540,
      currency: 'EUR',
      category: 'travel',
      groupId: group.id,
      paidById: alice.id,
      splitType: 'equal',
      splits: {
        create: [
          { userId: alice.id, amount: 180 },
          { userId: bob.id, amount: 180 },
          { userId: carol.id, amount: 180 },
        ],
      },
    },
  });

  // Personal expense between alice and bob
  await prisma.expense.create({
    data: {
      description: 'Netflix subscription',
      amount: 15.99,
      currency: 'USD',
      category: 'entertainment',
      paidById: alice.id,
      splitType: 'equal',
      splits: {
        create: [
          { userId: alice.id, amount: 7.995 },
          { userId: bob.id, amount: 7.995 },
        ],
      },
    },
  });

  // Activities
  await prisma.activity.createMany({
    data: [
      {
        userId: alice.id,
        groupId: group.id,
        type: 'group_created',
        description: 'Alice Johnson created group "Paris Trip 2024"',
      },
      {
        userId: alice.id,
        groupId: group.id,
        expenseId: dinner.id,
        type: 'expense_added',
        description: 'Alice Johnson added "Dinner at Le Jules Verne" (€180.00)',
      },
    ],
  });

  console.log('✅ Seed completed!');
  console.log('\nDemo accounts:');
  console.log('  alice@example.com / demo1234');
  console.log('  bob@example.com / demo1234');
  console.log('  carol@example.com / demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
