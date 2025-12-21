import express from "express";
import { config } from "./utils/config";
import { loggingMiddleware } from "./middleware/logging";
import { authMiddleware } from "./middleware/auth";
import { manifestHandler } from "./routes/manifest";
import { streamHandler } from "./routes/stream";
import { resolveHandler } from "./routes/resolve";
import { landingHandler } from "./routes/landing";

const app = express();

// Apply middleware
app.use(loggingMiddleware);
app.use(authMiddleware);

// Routes
app.get("/", landingHandler);
app.get("/manifest.json", manifestHandler);
app.get("/stream/:type/:id.json", streamHandler);
app.get("/resolve/realdebrid/*", resolveHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Addon server is running on port ${config.port}`);
});
