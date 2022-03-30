import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error', 'info', 'query'] });

const categories: Prisma.CategoryCreateInput[] = [
  {
    name: 'Politikë'
  },
  {
    name: 'Sport'
  },
  {
    name: 'Cultbiz'
  },
  {
    name: 'Biznes'
  },
  {
    name: 'Life'
  }
];

const roles: Prisma.RoleCreateInput[] = [
  { name: 'Admin' },
  { name: 'Journalist' },
  { name: 'User' }
];

async function createInitialData() {
  for (const category of categories) {
    await prisma.category.create({ data: category });
  }
  for (const role of roles) {
    await prisma.role.create({ data: role });
  }
}

createInitialData();
