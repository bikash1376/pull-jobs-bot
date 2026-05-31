import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function markTelegramUpdateProcessed(updateId: number): Promise<boolean> {
  try {
    await prisma.processedTelegramUpdate.create({
      data: { updateId: BigInt(updateId) },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return false;
    }
    throw error;
  }
}
