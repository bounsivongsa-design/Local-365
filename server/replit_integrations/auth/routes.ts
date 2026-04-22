import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { passwordHash: _, ...safeUser } = user;
      const impersonatorId = (req.session as any)?.impersonatorId;
      let impersonator: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null = null;
      if (impersonatorId && impersonatorId !== userId) {
        const admin = await authStorage.getUser(impersonatorId);
        if (admin) {
          impersonator = { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName };
        }
      }
      res.json({ ...safeUser, impersonator });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
