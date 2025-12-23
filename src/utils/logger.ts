import pino from "pino";
import path from "path";
import fs from "fs";

// Check if running in development
const isDevelopment = process.env.NODE_ENV !== "production";

// Determine log directory based on environment
// Development: ./logs in project directory
// Production: /var/log/torrentio-debrid-proxy (Linux standard) or fallback to ./logs
const getLogDirectory = (): string => {
  if (isDevelopment) {
    return path.join(process.cwd(), "logs");
  }

  // Production: Try to use /var/log, fall back to local logs if not writable
  const systemLogDir = "/var/log/torrentio-debrid-proxy";

  try {
    // Try to create the directory if it doesn't exist
    if (!fs.existsSync(systemLogDir)) {
      fs.mkdirSync(systemLogDir, { recursive: true });
    }

    // Test if we can write to it
    fs.accessSync(systemLogDir, fs.constants.W_OK);
    return systemLogDir;
  } catch {
    // Fall back to local logs directory if /var/log is not writable
    console.warn(
      `Warning: Cannot write to ${systemLogDir}, falling back to local logs directory`
    );
    return path.join(process.cwd(), "logs");
  }
};

const logDirectory = getLogDirectory();
const errorLogPath = path.join(logDirectory, "error.log");

// Base logger configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),

  // Development: human-readable with pino-pretty + file for errors
  // Production: JSON for log aggregation systems + file for errors
  transport: {
    targets: isDevelopment
      ? [
          // Console output with pretty formatting
          {
            target: "pino-pretty",
            level: "debug",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss.l",
              ignore: "pid,hostname",
              singleLine: false,
              messageFormat: "{levelLabel} [{context}] {msg}",
            },
          },
          // Error log file
          {
            target: "pino/file",
            level: "error",
            options: {
              destination: errorLogPath,
              mkdir: true,
            },
          },
        ]
      : [
          // Console output as JSON
          {
            target: "pino/file",
            level: "info",
            options: {
              destination: 1, // stdout
            },
          },
          // Error log file
          {
            target: "pino/file",
            level: "error",
            options: {
              destination: errorLogPath,
              mkdir: true,
            },
          },
        ],
  },

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
