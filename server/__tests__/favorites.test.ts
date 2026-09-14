import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { and, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";

import { db as pgDb } from "../db";
import { registerFavoriteRoutes } from "../favorites";
import { businessFavorites, businesses, reviews, users } from "@shared/schema";

const TEST_TAG = "__favorites_endpoint_test__";

let createdUserIds: string[] = [];
let createdBusinessIds: number[] = [];

async function seedUser(email: string) {
  const [user] = await pgDb
    .insert(users)
    .values({
      email: `${crypto.randomBytes(6).toString("hex")}-${email}`,
      firstName: "Favorite",
      lastName: "Tester",
      accountType: "customer",
    })
    .returning();
  createdUserIds.push(user.id);
  return user;
}

async function seedBusiness(name: string) {
  const [business] = await pgDb
    .insert(businesses)
    .values({
      name,
      description: TEST_TAG,
      address: "1 Favorite Way",
      category: "Service",
      imageUrl: "https://example.com/favorite.png",
      membershipTier: "basic",
    })
    .returning();
  createdBusinessIds.push(business.id);
  return business;
}

async function cleanup() {
  if (createdBusinessIds.length) {
    await pgDb.delete(reviews).where(inArray(reviews.businessId, createdBusinessIds));
    await pgDb.delete(businessFavorites).where(inArray(businessFavorites.businessId, createdBusinessIds));
    await pgDb.delete(businesses).where(inArray(businesses.id, createdBusinessIds));
    createdBusinessIds = [];
  }
  if (createdUserIds.length) {
    await pgDb.delete(businessFavorites).where(inArray(businessFavorites.userId, createdUserIds));
    await pgDb.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds = [];
  }
}

function makeApp(userId: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).isAuthenticated = () => !!userId;
    if (userId) (req as any).user = { id: userId };
    next();
  });
  registerFavoriteRoutes(app);
  return app;
}

function start(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

before(async () => {
  const oldBusinesses = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (oldBusinesses.length) {
    const ids = oldBusinesses.map(({ id }) => id);
    await pgDb.delete(businessFavorites).where(inArray(businessFavorites.businessId, ids));
    await pgDb.delete(reviews).where(inArray(reviews.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(cleanup);
after(cleanup);

test("favorite endpoints require an authenticated session", async () => {
  const business = await seedBusiness("Auth Required Vendor");
  const { url, close } = await start(makeApp(null));
  try {
    for (const [path, method] of [
      [`/api/user/favorites`, "GET"],
      [`/api/businesses/${business.id}/favorite`, "POST"],
      [`/api/businesses/${business.id}/favorite`, "DELETE"],
    ] as const) {
      const response = await fetch(`${url}${path}`, { method });
      assert.equal(response.status, 401);
    }
  } finally {
    await close();
  }
});

test("POST is idempotent, GET returns ratings, and favorites persist per user", async () => {
  const userA = await seedUser("favorite-a@example.com");
  const userB = await seedUser("favorite-b@example.com");
  const business = await seedBusiness("Persistent Vendor");
  await pgDb.insert(reviews).values({
    userId: userB.id,
    businessId: business.id,
    rating: 4,
    comment: "Great work",
  });
  await pgDb.insert(reviews).values({
    userId: userB.id,
    businessId: business.id,
    rating: 5,
    comment: "Would recommend",
  });

  const firstApp = await start(makeApp(userA.id));
  try {
    const first = await fetch(`${firstApp.url}/api/businesses/${business.id}/favorite`, { method: "POST" });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { businessId: business.id, favorited: true });

    const duplicate = await fetch(`${firstApp.url}/api/businesses/${business.id}/favorite`, { method: "POST" });
    assert.equal(duplicate.status, 200);

    const rows = await pgDb
      .select()
      .from(businessFavorites)
      .where(and(eq(businessFavorites.userId, userA.id), eq(businessFavorites.businessId, business.id)));
    assert.equal(rows.length, 1);

    const ownFavorites = await fetch(`${firstApp.url}/api/user/favorites`);
    assert.equal(ownFavorites.status, 200);
    const cards = await ownFavorites.json();
    assert.equal(cards.length, 1);
    assert.equal(cards[0].id, business.id);
    assert.equal(cards[0].reviewCount, 2);
    assert.equal(cards[0].averageRating, 4.5);
  } finally {
    await firstApp.close();
  }

  const persistedApp = await start(makeApp(userA.id));
  try {
    const persistedFavorites = await fetch(`${persistedApp.url}/api/user/favorites`);
    assert.equal(persistedFavorites.status, 200);
    assert.equal((await persistedFavorites.json()).length, 1);
  } finally {
    await persistedApp.close();
  }

  const secondApp = await start(makeApp(userB.id));
  try {
    const otherUserFavorites = await fetch(`${secondApp.url}/api/user/favorites`);
    assert.equal(otherUserFavorites.status, 200);
    assert.deepEqual(await otherUserFavorites.json(), []);

    // A user's DELETE cannot remove another user's saved row.
    const otherDelete = await fetch(`${secondApp.url}/api/businesses/${business.id}/favorite`, {
      method: "DELETE",
    });
    assert.equal(otherDelete.status, 200);
    const stillSaved = await pgDb
      .select()
      .from(businessFavorites)
      .where(and(eq(businessFavorites.userId, userA.id), eq(businessFavorites.businessId, business.id)));
    assert.equal(stillSaved.length, 1);
  } finally {
    await secondApp.close();
  }
});

test("DELETE is idempotent and removes only the current user's favorite", async () => {
  const user = await seedUser("favorite-remove@example.com");
  const business = await seedBusiness("Removable Vendor");
  const { url, close } = await start(makeApp(user.id));
  try {
    const missing = await fetch(`${url}/api/businesses/not-an-id/favorite`, { method: "DELETE" });
    assert.equal(missing.status, 400);

    const first = await fetch(`${url}/api/businesses/${business.id}/favorite`, { method: "DELETE" });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { businessId: business.id, favorited: false });

    const second = await fetch(`${url}/api/businesses/${business.id}/favorite`, { method: "DELETE" });
    assert.equal(second.status, 200);
    const favorites = await fetch(`${url}/api/user/favorites`);
    assert.deepEqual(await favorites.json(), []);
  } finally {
    await close();
  }
});

test("cannot favorite an archived or missing business", async () => {
  const user = await seedUser("favorite-validation@example.com");
  const business = await seedBusiness("Archived Vendor");
  await pgDb.update(businesses).set({ status: "archived" }).where(eq(businesses.id, business.id));

  const { url, close } = await start(makeApp(user.id));
  try {
    const archived = await fetch(`${url}/api/businesses/${business.id}/favorite`, { method: "POST" });
    assert.equal(archived.status, 404);
    const missing = await fetch(`${url}/api/businesses/999999999/favorite`, { method: "POST" });
    assert.equal(missing.status, 404);
  } finally {
    await close();
  }
});