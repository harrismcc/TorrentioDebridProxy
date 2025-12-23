import express, { type Request, type Response, type NextFunction } from "express";
import { config } from "./utils/config";
import { loggingMiddleware, requestTimingMiddleware } from "./middleware/logging";
import { authMiddleware } from "./middleware/auth";
import { manifestHandler } from "./routes/manifest";
import { streamHandler } from "./routes/stream";
import { resolveHandler } from "./routes/resolve";
import { landingHandler } from "./routes/landing";
import { logger, createLogger } from "./utils/logger";

// Create application logger
const appLogger = createLogger("app");

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  appLogger.fatal(
    {
      err: error,
      type: "uncaughtException",
    },
    "Uncaught exception detected - shutting down"
  );

  // Give logger time to flush
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));

  appLogger.fatal(
    {
      err: error,
      promise: promise.toString(),
      type: "unhandledRejection",
    },
    "Unhandled promise rejection detected - shutting down"
  );

  // Give logger time to flush
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  appLogger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  appLogger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

const app = express();

// Apply middleware (in order)
app.use(requestTimingMiddleware);
app.use(loggingMiddleware);
app.use(authMiddleware);

// Routes
app.get("/", landingHandler);
app.get("/manifest.json", manifestHandler);
app.get("/stream/:type/:id.json", streamHandler);
app.get("/resolve/realdebrid/*", resolveHandler);

// Express error handling middleware (must be after all routes)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorLogger = createLogger("express-error");

  errorLogger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
    "Express error handler caught error"
  );

  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
app.listen(config.port, () => {
  appLogger.info(
    { port: config.port },
    `Addon server is running on port ${config.port}`
  );
});
