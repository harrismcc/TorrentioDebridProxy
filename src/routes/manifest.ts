import type { Request, Response } from "express";
import type { StremioManifest } from "../types";
import { respond } from "../utils/response";

export const MANIFEST: StremioManifest = {
  id: "org.custom.socks-my-rocks-debrid-proxy",
  version: "1.0.0",
  name: "Socks My Rocks Debrid Proxy",
  description:
    "Socks My Rocks Debrid Proxy - Proxies Real-Debrid streaming links from Torrentio instance through the SMR server.",
  types: ["movie", "series"],
  resources: ["stream"],
  catalogs: [],
  idPrefixes: ["tt"],
};

export function manifestHandler(req: Request, res: Response): void {
  respond(res, MANIFEST);
}
