import { PrismaClient } from "@prisma/client";

// Global singleton instance for Prisma
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Resilient memory store for environments where PostgreSQL is not yet started
export const inMemoryStore = {
  documents: [
    {
      id: "doc-1",
      title: "Motor Vehicles (Amendment) Act 2019 Penalties",
      type: "Act",
      jurisdiction: "Central",
      effectiveDate: "2019-09-01",
      sourceUrl: "https://morth.nic.in",
      status: "indexed",
      chunkCount: 24,
      indexedAt: new Date(),
    },
    {
      id: "doc-2",
      title: "Central Motor Vehicles Rules Documents & Licensing",
      type: "Rules",
      jurisdiction: "Central",
      effectiveDate: "2019-09-01",
      sourceUrl: "https://morth.nic.in",
      status: "indexed",
      chunkCount: 18,
      indexedAt: new Date(),
    },
  ],
  sessions: [] as any[],
  messages: [] as any[],
  feedback: [] as any[],
  queryLogs: [] as any[],
};
