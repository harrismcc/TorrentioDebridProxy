import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types";
import { config } from "../utils/config";

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (config.apiKey && req.query.api_key !== config.apiKey) {
    console.warn(
      `Access Denied: Incorrect or missing api_key. Path: ${req.originalUrl}`
    );
    if (res.socket && !res.socket.destroyed) {
      res.socket.destroy();
    }
    return;
  }
  next();
}
