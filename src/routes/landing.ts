import type { Request, Response } from "express";
import { config } from "../utils/config";

export function landingHandler(_req: Request, res: Response): void {
  const requiresApiKey = !!config.apiKey;
  const manifestUrl = config.proxyServerUrl + "/manifest.json";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Torrentio Debrid Proxy</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center p-4">
  <div class="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
    <h1 class="text-2xl font-bold text-white mb-2">Torrentio Debrid Proxy</h1>
    <p class="text-gray-400 mb-6">Stream via Torrentio with Real-Debrid, proxied through your own server.</p>

    <form id="installForm" class="space-y-4">
      ${
        requiresApiKey
          ? `
      <div>
        <label for="apiKey" class="block text-sm font-medium text-gray-300 mb-1">API Key</label>
        <input
          type="text"
          id="apiKey"
          name="apiKey"
          required
          placeholder="Enter your API key"
          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      `
          : ""
      }

      <button
        type="submit"
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
      >
        Install to Stremio
      </button>
    </form>
  </div>

  <script>
    const form = document.getElementById('installForm');
    const manifestUrl = '${manifestUrl}';
    const requiresApiKey = ${requiresApiKey};

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      let url = manifestUrl;
      if (requiresApiKey) {
        const apiKey = document.getElementById('apiKey').value;
        url += '?api_key=' + encodeURIComponent(apiKey);
      }

      // Convert https:// to stremio:// for Stremio installation
      const stremioUrl = url.replace(/^https?:\\/\\//, 'stremio://');
      window.location.href = stremioUrl;
    });
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
}
