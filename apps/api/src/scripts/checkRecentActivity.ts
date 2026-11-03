import { prisma } from "../models/prisma";

async function main() {
  const queryLogs = await prisma.queryLog.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  console.log("=== Recent Query Logs ===");
  console.log(JSON.stringify(queryLogs, null, 2));

  const messages = await prisma.message.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  console.log("=== Recent Messages ===");
  console.log(JSON.stringify(messages, null, 2));
}

main().finally(() => prisma.$disconnect());

