import type { AppConfig } from "../types";
import { createLogger } from "./logger";

const logger = createLogger("config");

// Bun automatically loads .env files, no dotenv needed

function normalizeAndValidateTorrentioUrl(rawUrl: string | undefined): string {
  let url = rawUrl || "";

  if (url.startsWith("stremio://")) {
    logger.debug({ originalUrl: url }, "Converting stremio:// URL to https://");
    url = url.replace("stremio://", "https://");
  }

  url = url.replace(/\/manifest\.json$/, "");

  if (!url.startsWith("https://")) {
    logger.fatal(
      {
        providedUrl: rawUrl,
        normalizedUrl: url,
        envVar: "TORRENTIO_URL",
      },
      "TORRENTIO_URL validation failed: must be defined and start with https://"
    );
    process.exit(1);
  }

  logger.info({ torrentioUrl: url }, "Torrentio URL validated");
  return url;
}

function validateProxyServerUrl(url: string | undefined): string {
  if (!url) {
    logger.fatal(
      { envVar: "PROXY_SERVER_URL" },
      "PROXY_SERVER_URL validation failed: must be defined"
    );
    process.exit(1);
  }

  logger.info({ proxyServerUrl: url }, "Proxy server URL validated");
  return url;
}

// Validate configuration on module load
logger.info("Loading application configuration");

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "13470", 10),
  apiKey: process.env.API_KEY,
  torrentioUrl: normalizeAndValidateTorrentioUrl(process.env.TORRENTIO_URL),
  proxyServerUrl: validateProxyServerUrl(process.env.PROXY_SERVER_URL),
};

logger.info(
  {
    port: config.port,
    hasApiKey: !!config.apiKey,
    torrentioUrl: config.torrentioUrl,
    proxyServerUrl: config.proxyServerUrl,
  },
  "Application configuration loaded successfully"
);

if (config.apiKey) {
  logger.info("API_KEY is set - authentication enabled for all requests");
}
