import type { Response } from "express";
import type { Logger } from "./logger";

/**
 * Headers that should not be forwarded from Real-Debrid to client
 * These can cause compatibility issues with media players
 */
const BLOCKED_HEADERS = new Set([
  "transfer-encoding", // Can conflict with content-length
  "connection", // Should be managed by Express
  "keep-alive", // Should be managed by Express
  "upgrade", // Proxy doesn't support protocol upgrades
  "trailer", // Rarely needed, can confuse clients
]);

export interface HeaderForwardingResult {
  forwarded: number;
  blocked: number;
  added: number;
  warnings: string[];
}

/**
 * Safely forward headers from Real-Debrid response to client
 * with validation and normalization for media player compatibility
 */
export function forwardStreamHeaders(
  sourceHeaders: Headers,
  targetResponse: Response,
  statusCode: number,
  requestedRange: string | undefined,
  logger: Logger
): HeaderForwardingResult {
  const result: HeaderForwardingResult = {
    forwarded: 0,
    blocked: 0,
    added: 0,
    warnings: [],
  };

  // Step 1: Forward safe headers from Real-Debrid
  sourceHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    if (BLOCKED_HEADERS.has(lowerKey)) {
      result.blocked++;
      logger.debug({ header: key, value }, "Blocked problematic header");
      return;
    }

    targetResponse.setHeader(key, value);
    result.forwarded++;
  });

  // Step 2: Ensure Accept-Ranges header is ALWAYS present (CRITICAL FIX)
  if (!sourceHeaders.has("accept-ranges")) {
    targetResponse.setHeader("Accept-Ranges", "bytes");
    result.added++;
    result.warnings.push("Added missing Accept-Ranges header");
    logger.warn(
      "Accept-Ranges header missing from Real-Debrid response - added explicitly for player compatibility"
    );
  }

  // Step 3: Validate HTTP 206 responses have Content-Range (CRITICAL)
  if (statusCode === 206) {
    const contentRange = sourceHeaders.get("content-range");
    if (!contentRange) {
      result.warnings.push("HTTP 206 response missing Content-Range header");
      logger.error(
        { statusCode, requestedRange },
        "CRITICAL: HTTP 206 Partial Content response missing Content-Range header - stream will likely fail"
      );
    } else {
      // Validate Content-Range format: "bytes 123-456/789"
      const rangePattern = /^bytes \d+-\d+\/(\d+|\*)$/;
      if (!rangePattern.test(contentRange)) {
        result.warnings.push(`Invalid Content-Range format: ${contentRange}`);
        logger.error(
          { contentRange, requestedRange },
          "Content-Range header has invalid format"
        );
      }
    }
  }

  // Step 4: Warn if Range request got 200 instead of 206
  if (requestedRange && statusCode === 200) {
    result.warnings.push("Range request returned 200 OK instead of 206");
    logger.warn(
      { requestedRange, statusCode },
      "Range request returned full content (200) instead of partial (206) - seeking may not work properly"
    );
  }

  // Step 5: Add CORS headers for external player compatibility
  if (!sourceHeaders.has("access-control-allow-origin")) {
    targetResponse.setHeader("Access-Control-Allow-Origin", "*");
    result.added++;
  }
  if (!sourceHeaders.has("access-control-allow-headers")) {
    targetResponse.setHeader("Access-Control-Allow-Headers", "*");
    result.added++;
  }
  if (!sourceHeaders.has("access-control-expose-headers")) {
    targetResponse.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Range, Content-Length, Accept-Ranges"
    );
    result.added++;
  }

  return result;
}
