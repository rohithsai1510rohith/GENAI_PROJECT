import { createApp } from "./app";
import { config } from "./config";
import { syncDocuments } from "./services/documentSync";
import { logger } from "./utils/logger";

const app = createApp();

const server = app.listen(config.port, async () => {
  logger.info(`====================================================`);
  logger.info(`Traffic Rules & Fines API Gateway active on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`AI Microservice: ${config.aiServiceUrl}`);
  logger.info(`Database: ${config.databaseUrl ? "Configured" : "Unset"}`);
  logger.info(`====================================================`);

  // Check database connectivity
  const { checkDatabaseHealth } = await import("./models/prisma");
  const dbHealth = await checkDatabaseHealth();
  if (config.nodeEnv === "production" && !dbHealth.isHealthy) {
    logger.warn(
      { err: dbHealth.error },
      "Database connection pending or offline; in-memory statutory store active."
    );
    // Fall back non-fatally to in-memory store
  }

  // Seed dev admin in development environment if needed
  if (config.nodeEnv === "development") {
    try {
      const { registerUser } = await import("./services/authService");
      await registerUser("admin@trafficassistant.gov.in", "AdminSecretPass2026!");
      logger.info("Development admin account seeded (admin@trafficassistant.gov.in)");
    } catch {
      // already registered or offline
    }
  }

  // Non-fatal document synchronization on startup
  try {
    await syncDocuments();
  } catch (err: any) {
    logger.warn({ err: err.message }, "Startup document sync failed non-fatally");
  }
});

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Closing HTTP server gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed. Exiting process.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default server;
