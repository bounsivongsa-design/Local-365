import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db as pgDb } from "./db";
import { requestLogs } from "@shared/schema";
import { sql as drizzleSql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Strip a referer URL down to just its hostname so the Top Referrers list
// groups by site (e.g. instagram.com) rather than by every distinct landing
// path. Returns null for blank/invalid referers.
function refererToHost(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).host || null;
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);

      // Persist to request_logs for the admin Traffic tab. Fire-and-forget
      // so we never add latency to the response. Skips noisy paths to keep
      // table growth manageable. NODE_ENV=test is excluded so unit tests
      // don't accidentally hammer the dev DB.
      //
      // Privacy note: we store raw IP + user-agent here. Access is gated to
      // accountType=admin, the table auto-prunes at 30d, and this is the
      // operator's own site analytics — no third-party data is shared.
      // If we ever expose this beyond admins, hash the IP first.
      if (process.env.NODE_ENV !== "test" && !path.startsWith("/api/admin/analytics")) {
        const xff = req.headers["x-forwarded-for"];
        const ip =
          (Array.isArray(xff) ? xff[0] : xff?.split(",")[0])?.trim() ||
          req.socket.remoteAddress ||
          null;
        const refHost = refererToHost(
          (req.headers["referer"] as string | undefined) ||
            (req.headers["referrer"] as string | undefined),
        );
        const ua = (req.headers["user-agent"] as string | undefined) || null;
        // Cap path length defensively in case of pathological URLs.
        const safePath = path.length > 512 ? path.slice(0, 512) : path;
        pgDb
          .insert(requestLogs)
          .values({
            method: req.method,
            path: safePath,
            status: res.statusCode,
            durationMs: duration,
            ip,
            refererHost: refHost,
            userAgent: ua ? ua.slice(0, 512) : null,
          })
          .catch(() => {
            /* swallow — analytics must never break the request path */
          });
      }
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  const adminEmails = ["boun.sivongsa@gmail.com", "locallist365@gmail.com"];
  try {
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`UPDATE users SET is_admin = true, is_validated = true WHERE LOWER(email) IN (${sql.join(adminEmails.map(e => sql`${e}`), sql`, `)})`);
    await db.execute(sql`UPDATE users SET is_admin = false WHERE is_admin = true AND LOWER(email) NOT IN (${sql.join(adminEmails.map(e => sql`${e}`), sql`, `)})`);
    await db.execute(sql`UPDATE users SET first_name = 'Boun', last_name = 'Sivongsa' WHERE LOWER(email) = 'boun.sivongsa@gmail.com' AND (first_name != 'Boun' OR last_name != 'Sivongsa' OR first_name IS NULL)`);
    await db.execute(sql`UPDATE businesses SET city = 'Moyock', zip_code = '27958' WHERE city = 'Currituck' OR zip_code = '27929'`);
    await db.execute(sql`UPDATE events SET city = 'Moyock', zip_code = '27958' WHERE city = 'Currituck' OR zip_code = '27929'`);
  } catch (e) {
    console.error("Admin setup:", e);
  }

  // Recover any referral rows stuck in the 'processing' state from a
  // crash mid-credit during a previous boot. Safe + idempotent.
  try {
    const { requeueStuckProcessingReferrals } = await import("./referrals");
    await requeueStuckProcessingReferrals();
  } catch (e) {
    console.error("Referral requeue on boot:", e);
  }

  // Seed service-area zip rows (NC OBX/EC + VA Chesapeake/VB) — idempotent.
  try {
    const { seedServiceAreas } = await import("./locationSeed");
    const result = await seedServiceAreas();
    if (result.inserted > 0) {
      log(`Seeded ${result.inserted} service-area zips (existing: ${result.existing})`, "locations");
    }
  } catch (e) {
    console.error("Service-area seed:", e);
  }

  // Prune request_logs > 30 days at boot, then hourly. Keeps the analytics
  // table from growing unbounded — admin dashboard only ever queries the
  // last 30 days anyway.
  const pruneRequestLogs = async () => {
    try {
      await pgDb.execute(
        drizzleSql`DELETE FROM request_logs WHERE ts < NOW() - INTERVAL '30 days'`,
      );
    } catch (e) {
      console.error("[request_logs] prune failed:", e);
    }
  };
  pruneRequestLogs();
  setInterval(pruneRequestLogs, 60 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
