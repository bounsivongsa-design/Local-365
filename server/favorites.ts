import type { Express } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";
import { db } from "./db";
import { businesses } from "@shared/schema";

const businessIdSchema = z.coerce.number().int().positive();

function getUserId(req: any): string {
  return req.user.id;
}

function parseBusinessId(rawId: string) {
  const parsed = businessIdSchema.safeParse(rawId);
  return parsed.success ? parsed.data : null;
}

function getBusinessIdParam(req: any): string {
  const rawId = req.params.id;
  return Array.isArray(rawId) ? rawId[0] : rawId;
}

/**
 * Customer favorite endpoints. Every read/write is scoped to the session
 * user; the URL never accepts a user id and DELETE intentionally succeeds
 * when another user owns the row.
 */
export function registerFavoriteRoutes(app: Express) {
  app.get("/api/user/favorites", isAuthenticated, async (req, res) => {
    try {
      const favorites = await storage.getUserFavorites(getUserId(req));
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching user favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post("/api/businesses/:id/favorite", isAuthenticated, async (req, res) => {
    const businessId = parseBusinessId(getBusinessIdParam(req));
    if (businessId === null) {
      return res.status(400).json({ message: "Business id must be a positive integer" });
    }

    try {
      const [business] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(
          and(
            eq(businesses.id, businessId),
            sql`COALESCE(${businesses.status}, 'active') != 'archived'`,
          ),
        )
        .limit(1);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      await storage.addBusinessFavorite(getUserId(req), businessId);
      return res.json({ businessId, favorited: true });
    } catch (error) {
      console.error("Error saving business favorite:", error);
      return res.status(500).json({ message: "Failed to save favorite" });
    }
  });

  app.delete("/api/businesses/:id/favorite", isAuthenticated, async (req, res) => {
    const businessId = parseBusinessId(getBusinessIdParam(req));
    if (businessId === null) {
      return res.status(400).json({ message: "Business id must be a positive integer" });
    }

    try {
      // Scope the delete to the authenticated user. This is idempotent and
      // does not reveal whether another user saved the same business.
      await storage.removeBusinessFavorite(getUserId(req), businessId);
      return res.json({ businessId, favorited: false });
    } catch (error) {
      console.error("Error removing business favorite:", error);
      return res.status(500).json({ message: "Failed to remove favorite" });
    }
  });
}