import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  console.log("Connecting to DigitalOcean PostgreSQL...");
  
  // Create a dummy user to own the room
  const user = await db.user.create({
    data: {
      email: `host-${Date.now()}@conn3ct.com`,
      passwordHash: "password123",
      name: "Demo Host"
    }
  });

  // @ts-ignore
  await db.room.create({
    data: {
      slug: "demo-room-587",
      name: "Konn3ct MVP Demo Room",
      ownerId: user.id
    }
  });
  
  console.log("Success! Room 'demo-room-587' created in the production database.");
}

main()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
