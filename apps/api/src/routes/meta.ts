import { Router, Request, Response } from "express";
import { prisma, memoryStore } from "../models/prisma";
import { sendSuccess } from "../utils/envelope";
import { config } from "../config";

const router = Router();

router.get("/meta/filters", async (_req: Request, res: Response) => {
  // Query indexed jurisdictions and verification state dynamically
  let indexedJurisdictions = new Set<string>();
  let allActiveDocumentsVerified = false;
  let hasSampleOrUnverifiedData = true;
  let totalActiveDocuments = 0;

  try {
    const docs = await prisma.document.findMany({
      where: { status: { not: "inactive" } },
      select: { jurisdiction: true, verified: true, isTestData: true, supersededBy: true },
    });
    totalActiveDocuments = docs.length;
    for (const d of docs) {
      if (d.jurisdiction) indexedJurisdictions.add(d.jurisdiction.toLowerCase());
    }
    allActiveDocumentsVerified = docs.length > 0 && docs.every((d) => d.verified && !d.isTestData && !d.supersededBy);
    hasSampleOrUnverifiedData = docs.length === 0 || docs.some((d) => !d.verified || d.isTestData);
  } catch {
    const memDocs = Array.from(memoryStore.documents.values()).filter((d) => d.status !== "inactive");
    totalActiveDocuments = memDocs.length;
    for (const d of memDocs) {
      if (d.jurisdiction) indexedJurisdictions.add(d.jurisdiction.toLowerCase());
    }
    allActiveDocumentsVerified = memDocs.length > 0 && memDocs.every((d) => d.verified && !d.isTestData && !d.supersededBy);
    hasSampleOrUnverifiedData = memDocs.length === 0 || memDocs.some((d) => !d.verified || d.isTestData);
  }

  // Fallback: Central always has documents in the seeded knowledge base
  if (indexedJurisdictions.size === 0) {
    indexedJurisdictions.add("central");
  }

  const allJurisdictions = [
    { id: "Central", name: "Central (National)", hasDocuments: indexedJurisdictions.has("central") },
    { id: "Delhi", name: "Delhi (NCT)", hasDocuments: indexedJurisdictions.has("delhi") },
    { id: "Maharashtra", name: "Maharashtra", hasDocuments: indexedJurisdictions.has("maharashtra") },
    { id: "Karnataka", name: "Karnataka", hasDocuments: indexedJurisdictions.has("karnataka") },
    { id: "Tamil Nadu", name: "Tamil Nadu", hasDocuments: indexedJurisdictions.has("tamil nadu") },
    { id: "Uttar Pradesh", name: "Uttar Pradesh", hasDocuments: indexedJurisdictions.has("uttar pradesh") },
  ];

  const topics = [
    { id: "fines", name: "Traffic Fines & Penalties" },
    { id: "documents", name: "Vehicle Documents & Licensing" },
    { id: "e-challan", name: "E-Challan & Payment Rules" },
    { id: "road-safety", name: "Road Safety & Speed Rules" },
  ];

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
  return sendSuccess(res, {
    jurisdictions: allJurisdictions,
    topics,
    allActiveDocumentsVerified,
    hasSampleOrUnverifiedData,
    totalActiveDocuments,
  });
});

export default router;
