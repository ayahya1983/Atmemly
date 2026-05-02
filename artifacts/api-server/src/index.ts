import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime, shutdownRealtime } from "./lib/realtime";
import { validateEnv } from "./lib/env";

const env = validateEnv();
const port = Number(env.PORT);

const server = http.createServer(app);
initRealtime(server);

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info(
    { port, nodeEnv: env.NODE_ENV },
    "Server listening (with Socket.IO)",
  );
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutdown signal received, draining...");
  try {
    await shutdownRealtime();
  } catch (e) {
    logger.warn({ err: e }, "Realtime shutdown error");
  }
  const closeTimer = setTimeout(() => {
    logger.warn("Graceful shutdown timed out; forcing exit");
    process.exit(1);
  }, 10_000);
  server.close((err) => {
    clearTimeout(closeTimer);
    if (err) {
      logger.error({ err }, "Server close error");
      process.exit(1);
    }
    logger.info("Server closed cleanly");
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
});
