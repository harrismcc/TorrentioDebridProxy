import type { AppConfig } from "../types";

// Bun automatically loads .env files, no dotenv needed

function normalizeAndValidateTorrentioUrl(rawUrl: string | undefined): string {
  let url = rawUrl || "";

  if (url.startsWith("stremio://")) {
    url = url.replace("stremio://", "https://");
  }

  url = url.replace(/\/manifest\.json$/, "");

  if (!url.startsWith("https://")) {
    console.error("TORRENTIO_URL must be defined and start with https://");
    process.exit(1);
  }

  return url;
}

function validateProxyServerUrl(url: string | undefined): string {
  if (!url) {
    console.error("PROXY_SERVER_URL must be defined");
    process.exit(1);
  }
  return url;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || "13470", 10),
  apiKey: process.env.API_KEY,
  torrentioUrl: normalizeAndValidateTorrentioUrl(process.env.TORRENTIO_URL),
  proxyServerUrl: validateProxyServerUrl(process.env.PROXY_SERVER_URL),
};

if (config.apiKey) {
  console.log(
    "API_KEY is set. All requests will require it as an 'api_key=your_key' URL query parameter."
  );
}
