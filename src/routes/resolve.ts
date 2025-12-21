import type { Request, Response } from "express";
import { tryProxyStreamWithFallback } from "../services/realDebrid";

export function resolveHandler(req: Request, res: Response): void {
  const remotePath = req.params[0];
  const rangeHeader = req.headers["range"];

  tryProxyStreamWithFallback(remotePath, rangeHeader, res);
}
