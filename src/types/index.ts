import type { Request, Response, NextFunction } from "express";

export interface StremioManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  types: string[];
  resources: string[];
  catalogs: unknown[];
  idPrefixes: string[];
}

export interface StremioStream {
  url: string;
  title?: string;
  name?: string;
  [key: string]: unknown;
}

export interface StreamResponse {
  streams: StremioStream[];
}

export interface AppConfig {
  port: number;
  apiKey: string | undefined;
  torrentioUrl: string;
  proxyServerUrl: string;
}

export interface AuthenticatedRequest extends Request {
  query: {
    api_key?: string;
    [key: string]: string | undefined;
  };
}

export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export type AsyncRouteHandler = (
  req: Request,
  res: Response
) => Promise<void>;
