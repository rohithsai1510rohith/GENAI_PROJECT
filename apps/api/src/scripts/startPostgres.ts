// @ts-ignore
import EmbeddedPostgres from "embedded-postgres";
import path from "path";

async function run() {
  const dbDir = path.resolve(__dirname, "../../.pgdata");
  const pg = new (EmbeddedPostgres as any)({
    port: 5432,
    databaseDir: dbDir,
    user: "postgres",
    password: "postgrespassword",
    initdbFlags: ["-E", "UTF8", "--locale=C"],
  });

  try {
    await pg.initialise();
  } catch {
    // Already initialised
  }

  await pg.start();
  console.log("=================================================");
  console.log("Real PostgreSQL Server active on port 5432");
  console.log("User: postgres, Port: 5432");
  console.log("=================================================");

  // Create database traffic_assistant if it doesn't exist
  try {
    await pg.createDatabase("traffic_assistant");
    console.log("Database 'traffic_assistant' verified/created.");
  } catch (err: any) {
    // Database might already exist
    console.log("Database 'traffic_assistant' ready:", err.message || "ok");
  }

  const shutdown = async () => {
    console.log("Stopping PostgreSQL...");
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

run().catch((err) => {
  console.error("Failed to start PostgreSQL:", err);
  process.exit(1);
});
