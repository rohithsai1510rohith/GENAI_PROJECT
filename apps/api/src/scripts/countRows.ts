import { prisma } from "../models/prisma";

async function check() {
  const [messages, feedback, queryLog, auditLog, documents, refreshTokens] = await Promise.all([
    prisma.message.count(),
    prisma.feedback.count(),
    prisma.queryLog.count(),
    prisma.auditLog.count(),
    prisma.document.count(),
    prisma.refreshToken.count(),
  ]);
  console.log(JSON.stringify({ messages, feedback, queryLog, auditLog, documents, refreshTokens }, null, 2));
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
