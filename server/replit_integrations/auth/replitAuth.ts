import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { authStorage } from "./storage";
import { passwordResetTokens, users } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { sendPasswordResetEmail } from "../../email";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user || null);
    } catch (err) {
      cb(err, null);
    }
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await authStorage.getUserByEmail(email.toLowerCase().trim());
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (!user.passwordHash) {
            return done(null, false, { message: "This account uses Google sign-in. Please sign in with Google." });
          }
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, accountType, businessName, acceptedTerms } = req.body;

      if (!acceptedTerms) {
        return res.status(400).json({ message: "You must accept the Terms of Service and Privacy Policy to register" });
      }

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      if (accountType === "business" && !businessName?.trim()) {
        return res.status(400).json({ message: "Business name is required for business accounts" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await authStorage.getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await authStorage.createUser({
        email: normalizedEmail,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        accountType: accountType === "business" ? "business" : "customer",
        pendingBusinessName: accountType === "business" ? (businessName?.trim() || null) : null,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { passwordHash: _, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        const { passwordHash: _, ...safeUser } = user;
        res.json(safeUser);
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.json({ success: true });
      });
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await authStorage.getUserByEmail(normalizedEmail);

      if (!user) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }

      if (!user.passwordHash) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const allowedHosts = [
        process.env.REPLIT_DEV_DOMAIN,
        process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null,
        "localhost:5000",
      ].filter(Boolean);
      const requestHost = req.get("host") || "";
      const host = allowedHosts.includes(requestHost) ? requestHost : allowedHosts[0] || "localhost:5000";
      const protocol = host.includes("localhost") ? "http" : "https";
      const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;

      await sendPasswordResetEmail(normalizedEmail, resetUrl);

      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (err) {
      console.error("Forgot password error:", err);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [resetRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!resetRecord) {
        return res.status(400).json({ message: "This reset link is invalid or has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ passwordHash }).where(eq(users.id, resetRecord.userId));
        await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetRecord.id));
      });

      res.json({ message: "Your password has been reset successfully. You can now sign in." });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
