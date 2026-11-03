import { syncDocuments } from "../services/documentSync";

async function main() {
  console.log("Running document sync CLI...");
  const result = await syncDocuments();
  console.log(`Sync complete. Synced: ${result.syncedCount}, Success: ${result.success}`);
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error during document sync CLI:", err);
  process.exit(1);
});
