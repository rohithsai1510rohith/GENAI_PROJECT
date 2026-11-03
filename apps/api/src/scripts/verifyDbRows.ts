import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Checking Real PostgreSQL Records ===");

  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(`\nMessages count: ${messages.length}`);
  for (const m of messages) {
    console.log({
      id: m.id,
      role: m.role,
      latencyMs: m.latencyMs,
      createdAt: m.createdAt,
      contentSnippet: m.content.slice(0, 80) + "...",
    });
  }

  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(`\nFeedback count: ${feedbacks.length}`);
  for (const f of feedbacks) {
    console.log({
      id: f.id,
      messageId: f.messageId,
      rating: f.rating,
      reason: f.reason,
      createdAt: f.createdAt,
    });
  }

  const queryLogs = await prisma.queryLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(`\nQueryLog count: ${queryLogs.length}`);
  for (const q of queryLogs) {
    console.log({
      id: q.id,
      question: q.question,
      topScore: q.topScore,
      answered: q.answered,
      createdAt: q.createdAt,
    });
  }

  console.log("\n=== Direct Database Verification Successful ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
