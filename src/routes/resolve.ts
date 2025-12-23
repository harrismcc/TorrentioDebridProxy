import type { Request, Response } from "express";
import { tryProxyStreamWithFallback } from "../services/realDebrid";
import { createLogger } from "../utils/logger";

const logger = createLogger("resolveHandler");

// CRITICAL FIX: Make handler async and await the async call
export async function resolveHandler(req: Request, res: Response): Promise<void> {
  const remotePath = req.params[0];
  const rangeHeader = req.headers["range"];

  logger.debug(
    { remotePath, hasRange: !!rangeHeader },
    "Resolve request received"
  );

  try {
    // CRITICAL: Now properly awaits async function
    await tryProxyStreamWithFallback(remotePath, rangeHeader, res);

    logger.info(
      { remotePath, statusCode: res.statusCode },
      "Stream proxy completed"
    );
  } catch (error) {
    // Catch any errors that escape from tryProxyStreamWithFallback
    logger.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        remotePath,
      },
      "Fatal error in resolve handler"
    );

    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).send("Internal server error");
    }
  }
}
