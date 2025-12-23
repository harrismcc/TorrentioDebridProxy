import type { Response } from "express";
import { createLogger } from "../utils/logger";
import { logHttpRequest, logHttpResponse, logHttpError } from "../utils/httpLogger";

const logger = createLogger("realDebrid");

// Cache for resolved Real-Debrid URLs
const resolvedUrlCache = new Map<string, string>();

export async function resolveRDUrl(
  torrentioUrl: string
): Promise<string | null> {
  const startTime = Date.now();

  try {
    logger.debug({ torrentioUrl }, "Resolving Real-Debrid redirect");

    logHttpRequest(logger, "HEAD", torrentioUrl);

    const resp = await fetch(torrentioUrl, {
      method: "HEAD",
      redirect: "manual",
    });

    const redirectedUrl = resp.headers.get("location");

    if (!redirectedUrl) {
      logger.error(
        {
          torrentioUrl,
          statusCode: resp.status,
          headers: Object.fromEntries(resp.headers.entries()),
        },
        "No redirect location header found in Torrentio response"
      );
      return null;
    }

    const duration = Date.now() - startTime;
    logger.info(
      {
        torrentioUrl,
        redirectedUrl: redirectedUrl.length > 100
          ? redirectedUrl.substring(0, 100) + "..."
          : redirectedUrl,
        duration,
        cached: false,
      },
      "Successfully resolved Real-Debrid URL"
    );

    const cacheKey = torrentioUrl.split("/resolve/realdebrid/")[1];
    if (cacheKey) {
      resolvedUrlCache.set(cacheKey, redirectedUrl);
      logger.debug({ cacheKey, cacheSize: resolvedUrlCache.size }, "URL cached");
    }

    return redirectedUrl;
  } catch (err) {
    logHttpError(logger, "HEAD", torrentioUrl, err, startTime);
    return null;
  }
}

export async function tryProxyStreamWithFallback(
  remotePath: string,
  rangeHeader: string | undefined,
  res: Response
): Promise<void> {
  const torrentioUrl = `https://torrentio.strem.fun/resolve/realdebrid/${remotePath}`;

  logger.info(
    {
      remotePath,
      hasRange: !!rangeHeader,
      hasCachedUrl: resolvedUrlCache.has(remotePath),
    },
    "Starting stream proxy"
  );

  const tryFetchAndProxy = async (
    url: string,
    isRetry = false
  ): Promise<void> => {
    const controller = new AbortController();
    const signal = controller.signal;
    const fetchStartTime = Date.now();

    try {
      const headers: HeadersInit = rangeHeader ? { Range: rangeHeader } : {};

      logHttpRequest(logger, "GET", url, {
        remotePath,
        hasRange: !!rangeHeader,
        isRetry,
      });

      const proxyResp = await fetch(url, { headers, signal });

      const fetchDuration = Date.now() - fetchStartTime;

      // Handle 404 with retry logic
      if (proxyResp.status === 404 && !isRetry) {
        logger.warn(
          {
            url,
            remotePath,
            statusCode: 404,
            duration: fetchDuration,
          },
          "Cached RD URL returned 404, invalidating cache and retrying"
        );

        resolvedUrlCache.delete(remotePath);

        const retryUrl = await resolveRDUrl(torrentioUrl);
        if (!retryUrl) {
          logger.error({ remotePath }, "Failed to resolve URL on retry");
          if (!res.headersSent) {
            res.status(502).send("Failed to resolve stream URL after retry");
          }
          return;
        }

        return tryFetchAndProxy(retryUrl, true);
      }

      if (!proxyResp.ok) {
        logger.error(
          {
            url,
            remotePath,
            statusCode: proxyResp.status,
            statusText: proxyResp.statusText,
            duration: fetchDuration,
          },
          "Real-Debrid fetch failed with non-OK status"
        );

        if (!res.headersSent) {
          res.status(proxyResp.status).send("Failed to fetch stream");
        }
        return;
      }

      logger.info(
        {
          remotePath,
          statusCode: proxyResp.status,
          contentLength: proxyResp.headers.get("content-length"),
          contentType: proxyResp.headers.get("content-type"),
          duration: fetchDuration,
        },
        "Real-Debrid stream fetch successful, starting proxy"
      );

      res.status(proxyResp.status);
      proxyResp.headers.forEach((val, key) => res.setHeader(key, val));

      const TIMEOUT_MS = 5 * 60 * 1000;
      let timeout: Timer = setTimeout(() => {
        logger.warn(
          { remotePath, timeoutMs: TIMEOUT_MS },
          "Stream idle timeout - aborting"
        );
        controller.abort();
      }, TIMEOUT_MS);

      res.on("close", () => {
        clearTimeout(timeout);
        controller.abort();
        logger.debug({ remotePath }, "Client disconnected, stream aborted");
      });

      if (!proxyResp.body) {
        logger.error({ remotePath }, "Response has no body");
        if (!res.headersSent) {
          res.status(502).send("No response body");
        }
        return;
      }

      // Stream the response body to the client
      const reader = proxyResp.body.getReader();
      let bytesStreamed = 0;
      const streamStartTime = Date.now();

      const pump = async (): Promise<void> => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            bytesStreamed += value.length;

            // Reset timeout on data received
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              logger.warn(
                { remotePath, bytesStreamed, timeoutMs: TIMEOUT_MS },
                "Stream idle timeout after data transfer"
              );
              controller.abort();
            }, TIMEOUT_MS);

            res.write(value);
          }

          const streamDuration = Date.now() - streamStartTime;
          logger.info(
            {
              remotePath,
              bytesStreamed,
              duration: streamDuration,
              throughputMbps: (bytesStreamed / 1024 / 1024) / (streamDuration / 1000),
            },
            "Stream completed successfully"
          );

          res.end();
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            logger.warn(
              { remotePath, bytesStreamed },
              "Stream aborted (timeout or client disconnect)"
            );
          } else {
            logger.error(
              {
                err: err instanceof Error ? err : new Error(String(err)),
                remotePath,
                bytesStreamed,
              },
              "Stream pump error"
            );
          }

          if (!res.headersSent) {
            res.status(502).send("Stream failed");
          }
        }
      };

      await pump();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        logger.warn({ remotePath }, "Fetch aborted");
      } else {
        const duration = Date.now() - fetchStartTime;
        logger.error(
          {
            err: err instanceof Error ? err : new Error(String(err)),
            remotePath,
            url,
            duration,
          },
          "Proxy fetch failed"
        );
      }

      if (!res.headersSent) {
        res.status(502).send("Proxy failed");
      }
    }
  };

  // Check cache first
  if (resolvedUrlCache.has(remotePath)) {
    logger.debug({ remotePath }, "Using cached RD URL");
    return tryFetchAndProxy(resolvedUrlCache.get(remotePath)!);
  }

  // Resolve URL first
  const newUrl = await resolveRDUrl(torrentioUrl);
  if (!newUrl) {
    logger.error({ remotePath }, "Initial URL resolution failed");
    if (!res.headersSent) {
      res.status(502).send("Failed to resolve stream URL");
    }
    return;
  }

  return tryFetchAndProxy(newUrl);
}
