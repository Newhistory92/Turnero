import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  const globalWithPrisma = global as typeof globalThis & {
    prisma: PrismaClient;
  };
  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient();
  }
  prisma = globalWithPrisma.prisma;
}

// Modifica la definición de executePrismaOperation
async function executePrismaOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await prisma.$connect();
    return await operation(); 
  } catch (error) {
    console.error("Error during Prisma operation:", error);
    throw error; 
  } finally {
    await prisma.$disconnect();
  }
}

export { executePrismaOperation, prisma };