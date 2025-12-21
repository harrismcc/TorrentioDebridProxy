import type { Request, Response } from "express";
import type { StremioManifest } from "../types";
import { respond } from "../utils/response";

export const MANIFEST: StremioManifest = {
  id: "org.custom.torrentio-debrid-proxy",
  version: "1.0.0",
  name: "Torrentio Debrid Proxy",
  description:
    "Streams via Torrentio with Real-Debrid, proxied through your own server.",
  types: ["movie", "series"],
  resources: ["stream"],
  catalogs: [],
  idPrefixes: ["tt"],
};

export function manifestHandler(req: Request, res: Response): void {
  respond(res, MANIFEST);
}
