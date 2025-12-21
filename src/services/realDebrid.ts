import type { Response } from "express";

// Cache for resolved Real-Debrid URLs
const resolvedUrlCache = new Map<string, string>();

export async function resolveRDUrl(
  torrentioUrl: string
): Promise<string | null> {
  try {
    console.log("Resolving redirect:", torrentioUrl);
    const resp = await fetch(torrentioUrl, {
      method: "HEAD",
      redirect: "manual",
    });

    const redirectedUrl = resp.headers.get("location");
    if (!redirectedUrl) {
      console.error("No redirect found for:", torrentioUrl);
      return null;
    }

    const cacheKey = torrentioUrl.split("/resolve/realdebrid/")[1];
    if (cacheKey) {
      resolvedUrlCache.set(cacheKey, redirectedUrl);
      console.log("Cached redirect:", redirectedUrl, "for key:", cacheKey);
    }
    return redirectedUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Redirect resolve error for:", torrentioUrl, message);
    return null;
  }
}

export async function tryProxyStreamWithFallback(
  remotePath: string,
  rangeHeader: string | undefined,
  res: Response
): Promise<void> {
  const torrentioUrl = `https://torrentio.strem.fun/resolve/realdebrid/${remotePath}`;

  const tryFetchAndProxy = async (
    url: string,
    isRetry = false
  ): Promise<void> => {
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const headers: HeadersInit = rangeHeader ? { Range: rangeHeader } : {};
      const proxyResp = await fetch(url, { headers, signal });

      if (proxyResp.status === 404 && !isRetry) {
        console.warn(
          "Cached RD URL returned 404. Retrying without cache:",
          remotePath
        );
        resolvedUrlCache.delete(remotePath);

        const retryUrl = await resolveRDUrl(torrentioUrl);
        if (!retryUrl) {
          if (!res.headersSent) {
            res.status(502).send("Failed to resolve stream URL after retry");
          }
          return;
        }

        return tryFetchAndProxy(retryUrl, true);
      }

      if (!proxyResp.ok) {
        console.error(`Remote fetch failed (${url}):`, proxyResp.status);
        if (!res.headersSent) {
          res.status(proxyResp.status).send("Failed to fetch stream");
        }
        return;
      }

      res.status(proxyResp.status);
      proxyResp.headers.forEach((val, key) => res.setHeader(key, val));

      const TIMEOUT_MS = 5 * 60 * 1000;
      let timeout: Timer = setTimeout(() => {
        console.log(
          `No activity detected for stream ${remotePath}. Aborting.`
        );
        controller.abort();
      }, TIMEOUT_MS);

      res.on("close", () => {
        clearTimeout(timeout);
        controller.abort();
      });

      if (!proxyResp.body) {
        if (!res.headersSent) {
          res.status(502).send("No response body");
        }
        return;
      }

      // Stream the response body to the client
      const reader = proxyResp.body.getReader();

      const pump = async (): Promise<void> => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Reset timeout on data received
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              console.log(`Idle timeout for stream ${remotePath}. Aborting.`);
              controller.abort();
            }, TIMEOUT_MS);

            res.write(value);
          }
          res.end();
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            console.warn(`Stream aborted: ${remotePath}`);
          } else {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Stream error for ${remotePath}:`, message);
          }
          if (!res.headersSent) {
            res.status(502).send("Stream failed");
          }
        }
      };

      await pump();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(`Stream aborted: ${remotePath}`);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Proxy error for ${remotePath}:`, message);
      }

      if (!res.headersSent) {
        res.status(502).send("Proxy failed");
      }
    }
  };

  if (resolvedUrlCache.has(remotePath)) {
    return tryFetchAndProxy(resolvedUrlCache.get(remotePath)!);
  }

  const newUrl = await resolveRDUrl(torrentioUrl);
  if (!newUrl) {
    if (!res.headersSent) {
      res.status(502).send("Failed to resolve stream URL");
    }
    return;
  }

  return tryFetchAndProxy(newUrl);
}
