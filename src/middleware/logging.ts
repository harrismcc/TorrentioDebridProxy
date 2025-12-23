import type { Request, Response, NextFunction } from "express";
import pinoHttp from "pino-http";
import { logger } from "../utils/logger";
import { randomUUID } from "crypto";

// Import types to ensure Express augmentation is applied
import "../types";

// Create pino-http middleware with custom configuration
export const loggingMiddleware = pinoHttp({
  logger,

  // Generate unique request ID for correlation
  genReqId: (req, res) => {
    const existingId = req.headers["x-request-id"];
    if (existingId) return existingId as string;

    const id = randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },

  // Custom request logging
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    if (res.statusCode >= 300) return "info";
    return "info";
  },

  // Additional request context
  customAttributeKeys: {
    req: "request",
    res: "response",
    err: "error",
    responseTime: "duration",
  },

  // Serialize request/response
  // Note: pino-http's req serializer receives a different object than Express Request,
  // so we access Express-specific properties via the raw property when available
  serializers: {
    req: (req) => {
      // pino-http provides raw Express request via req.raw when available
      const rawReq = (req as any).raw || req;
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        path: rawReq.path,
        query: rawReq.query,
        params: rawReq.params,
        headers: {
          "user-agent": req.headers["user-agent"],
          range: req.headers["range"],
          referer: req.headers["referer"],
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      };
    },
    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        "content-type": res.getHeader("content-type"),
        "content-length": res.getHeader("content-length"),
        "x-request-id": res.getHeader("x-request-id"),
      },
    }),
  },

  // Don't log successful static asset requests at info level
  autoLogging: {
    ignore: (req) => req.url === "/favicon.ico",
  },
});

// Add request start time for manual timing
export function requestTimingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.startTime = Date.now();
  next();
}
