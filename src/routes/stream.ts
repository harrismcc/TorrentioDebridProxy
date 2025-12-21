import type { Request, Response } from "express";
import axios from "axios";
import type { StremioStream, StreamResponse } from "../types";
import { config } from "../utils/config";
import { respond } from "../utils/response";

interface TorrentioResponse {
  streams?: StremioStream[];
}

export async function streamHandler(req: Request, res: Response): Promise<void> {
  const { type, id } = req.params;
  console.log("Processing stream request (access-checked):", type, id);

  const apiUrl = `${config.torrentioUrl}/stream/${type}/${id}.json`;

  try {
    const { data } = await axios.get<TorrentioResponse>(apiUrl);

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

    respond(res, { streams });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to fetch stream data:", message);
    respond(res, { streams: [] });
  }
}
