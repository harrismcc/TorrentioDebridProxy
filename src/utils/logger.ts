import pino from "pino";

// Check if running in development
const isDevelopment = process.env.NODE_ENV !== "production";

// Base logger configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),

  // Development: human-readable with pino-pretty
  // Production: JSON for log aggregation systems
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
          singleLine: false,
          messageFormat: "{levelLabel} [{context}] {msg}",
        },
      }
    : undefined,

  // Base context for all logs
  base: {
    app: "torrentio-debrid-proxy",
  },

  // Serialize errors properly with stack traces
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

// Create child logger with additional context
export function createLogger(context: string) {
  return logger.child({ context });
}

// Export types for consistency
export type Logger = pino.Logger;
