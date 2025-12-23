import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types";
import { config } from "../utils/config";
import { createLogger } from "../utils/logger";

const logger = createLogger("auth");

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Skip auth for landing page
  if (req.path === "/") {
    return next();
  }

  if (config.apiKey && req.query.api_key !== config.apiKey) {
    logger.warn(
      {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        hasApiKey: !!req.query.api_key,
        requestId: (req as any).id,
      },
      "Access denied: incorrect or missing API key"
    );

    if (res.socket && !res.socket.destroyed) {
      res.socket.destroy();
    }
    return;
  }

  logger.debug(
    {
      path: req.originalUrl,
      requestId: (req as any).id,
    },
    "Authentication successful"
  );

  next();
}
