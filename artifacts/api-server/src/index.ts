import { logger } from "./lib/logger";
import { ensureAdminTreasuryContextSchema } from "./lib/startupSchema";

async function start(): Promise<void> {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  await ensureAdminTreasuryContextSchema();
  const { default: app } = await import("./app");
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start().catch((err) => {
  logger.error({ err }, "Backend startup failed");
  process.exit(1);
});
