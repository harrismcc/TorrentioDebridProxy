import type { Request, Response } from "express";
import axios, { type AxiosResponse } from "axios";
import type { StremioStream, StreamResponse } from "../types";
import { config } from "../utils/config";
import { respond } from "../utils/response";
import { createLogger } from "../utils/logger";
import { logHttpRequest, logHttpResponse, logHttpError } from "../utils/httpLogger";

interface TorrentioResponse {
  streams?: StremioStream[];
}

const logger = createLogger("streamHandler");

export async function streamHandler(req: Request, res: Response): Promise<void> {
  const { type, id } = req.params;
  const requestId = req.id;

  logger.info(
    { type, id, requestId },
    "Processing stream request"
  );

  const apiUrl = `${config.torrentioUrl}/stream/${type}/${id}.json`;
  const startTime = Date.now();

  try {
    // Log outgoing request to Torrentio
    logHttpRequest(logger, "GET", apiUrl, { type, id });

    const response: AxiosResponse<TorrentioResponse> = await axios.get<TorrentioResponse>(apiUrl, {
      timeout: 10000, // 10 second timeout
    });

    // Log successful response with actual status from axios
    logHttpResponse(logger, "GET", apiUrl, response, startTime, {
      streamCount: response.data.streams?.length || 0,
    });

    const data = response.data;

    const streams = (data.streams || []).map((stream) => {
      if (!stream.url.includes("/realdebrid/")) return stream;

      let newUrl = stream.url.replace(
        "https://torrentio.strem.fun",
        config.proxyServerUrl
      );
      if (config.apiKey) {
        const sep = newUrl.includes("?") ? "&" : "?";
        newUrl += `${sep}api_key=${encodeURIComponent(config.apiKey)}`;
      }

      return { ...stream, url: newUrl };
    });

    const rdStreamCount = streams.filter((s) => s.url.includes("/realdebrid/")).length;
    logger.debug(
      { totalStreams: streams.length, realDebridStreams: rdStreamCount },
      "Stream URLs processed"
    );

    respond(res, { streams });
  } catch (err) {
    // Log HTTP error with full context
    logHttpError(logger, "GET", apiUrl, err, startTime, { type, id });

    // Still respond with empty streams rather than crashing
    logger.warn("Returning empty streams due to Torrentio API error");
    respond(res, { streams: [] });
  }
}
