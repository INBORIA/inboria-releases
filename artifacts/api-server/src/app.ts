import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.set("etag", false);
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(
  express.json({
    limit: "10mb",
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      const url = req.originalUrl || "";
      if (
        url.startsWith("/api/paddle/webhook") ||
        url.startsWith("/api/messaging/whatsapp/webhook") ||
        url.startsWith("/api/integrations/hubspot/webhook") ||
        url.startsWith("/api/integrations/pipedrive/webhook")
      ) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Public developer documentation alias — exposed at root so that the spec'd
// paths /dev and /v1/public/openapi.json are reachable without the /api prefix.
import("./routes/public-api").then(({ devDocsRouter }) => {
  app.use("/", devDocsRouter);
}).catch(() => { /* optional */ });

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
