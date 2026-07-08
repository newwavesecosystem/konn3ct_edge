const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const recording = await prisma.recording.findUnique({
    where: { id: 'cmr7xnv8p0005cy01vlwuqnu7' }
  });
  console.log(recording);
}

main().catch(console.error).finally(() => prisma.$disconnect());
