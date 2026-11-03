import { prisma } from "../models/prisma";

async function unlock() {
  await prisma.user.update({
    where: { email: "admin@trafficassistant.gov.in" },
    data: { failedAttempts: 0, lockoutUntil: null },
  });
  console.log("Admin unlocked successfully in PostgreSQL");
}

unlock()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
