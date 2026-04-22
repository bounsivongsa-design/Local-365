// Tests for processMembershipActivation — the post-activation hook that
// assigns the next founding-member number when a business flips to a paid
// tier. Specifically covers the concurrency-safe assignment path
// (`tryAssignFoundingNumber`) and the hard cap at #100.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses } from "@shared/schema";
import { processMembershipActivation } from "../referrals";

const TEST_TAG = "__founding_activation_test__";
const FOUNDING_MEMBER_LIMIT = 100;

let createdBusinessIds: number[] = [];

async function seedBusiness(opts: {
  name: string;
  membershipTier?: "none" | "basic" | "standard" | "premium";
  isFoundingMember?: boolean;
  foundingMemberNumber?: number | null;
}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: opts.name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${opts.name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      membershipTier: opts.membershipTier ?? "basic",
      isFoundingMember: opts.isFoundingMember ?? false,
      foundingMemberNumber: opts.foundingMemberNumber ?? null,
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb.delete(businesses).where(inArray(businesses.id, createdBusinessIds));
  createdBusinessIds = [];
}

before(async () => {
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    await pgDb.delete(businesses).where(inArray(businesses.id, stragglers.map((s) => s.id)));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
});

async function getMaxFoundingNumber(): Promise<number> {
  const [row] = await pgDb
    .select({ max: sql<number>`COALESCE(MAX(${businesses.foundingMemberNumber}), 0)::int` })
    .from(businesses)
    .where(isNotNull(businesses.foundingMemberNumber));
  return row?.max ?? 0;
}

test("paid tier gets the next founding number assigned (one above current MAX)", async () => {
  const before = await getMaxFoundingNumber();
  // Skip when DB is already at the cap — exercising concurrency below
  // would require evicting real founding rows, which we won't touch.
  if (before >= FOUNDING_MEMBER_LIMIT) {
    return;
  }
  const biz = await seedBusiness({ name: "Founding Solo", membershipTier: "premium" });

  const result = await processMembershipActivation(biz.id);

  assert.equal(result.foundingNumber, before + 1, "must assign MAX+1");
  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(row.isFoundingMember, true);
  assert.equal(row.foundingMemberNumber, before + 1);
});

test("non-paid tier ('none') is ignored — no founding number, no row changes", async () => {
  const biz = await seedBusiness({ name: "Free Tier", membershipTier: "none" });

  const result = await processMembershipActivation(biz.id);

  assert.equal(result.foundingNumber, null);
  assert.equal(result.referralRewarded, false);
  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(row.isFoundingMember, false);
  assert.equal(row.foundingMemberNumber, null);
});

test("re-activating an already-founding business is a no-op (number is preserved)", async () => {
  const biz = await seedBusiness({
    name: "Already Founded",
    membershipTier: "standard",
    isFoundingMember: true,
    foundingMemberNumber: null, // gated only by isFoundingMember=true
  });

  const result = await processMembershipActivation(biz.id);

  assert.equal(result.foundingNumber, null, "must not re-assign once flagged");
  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(row.foundingMemberNumber, null);
});

test("missing business id returns the empty result instead of throwing", async () => {
  const result = await processMembershipActivation(-99999);
  assert.equal(result.foundingNumber, null);
  assert.equal(result.referralRewarded, false);
  assert.equal(result.referrerBusinessId, null);
});

test("concurrent activations get DISTINCT, sequential founding numbers (no UNIQUE collisions)", async () => {
  const before = await getMaxFoundingNumber();
  const headroom = FOUNDING_MEMBER_LIMIT - before;
  if (headroom < 5) {
    // Not enough room to safely race 5 inserts without crossing the cap.
    return;
  }

  const seeds = await Promise.all(
    [1, 2, 3, 4, 5].map((i) =>
      seedBusiness({ name: `Race Founder ${i} ${Date.now()}`, membershipTier: "basic" }),
    ),
  );

  const results = await Promise.all(seeds.map((s) => processMembershipActivation(s.id)));
  const numbers = results.map((r) => r.foundingNumber).filter((n): n is number => n != null).sort((a, b) => a - b);

  assert.equal(numbers.length, 5, "every concurrent activation must succeed");
  // All five numbers must be unique and contiguous starting at before+1.
  assert.deepEqual(
    numbers,
    [before + 1, before + 2, before + 3, before + 4, before + 5],
    "concurrent activations must each get a distinct, sequential number",
  );
});

test("hard cap: when the table already holds 100 founding members, the 101st returns null", async () => {
  const before = await getMaxFoundingNumber();
  const need = FOUNDING_MEMBER_LIMIT - before;

  // Fill to the cap with placeholder founding rows. Numbers above the
  // existing MAX so we never collide with real prod-like data.
  for (let i = 1; i <= need; i++) {
    await seedBusiness({
      name: `Placeholder Founder ${before + i} ${Date.now()}-${i}`,
      membershipTier: "basic",
      isFoundingMember: true,
      foundingMemberNumber: before + i,
    });
  }

  const overflow = await seedBusiness({
    name: "Too Late Founder",
    membershipTier: "premium",
  });

  const result = await processMembershipActivation(overflow.id);
  assert.equal(result.foundingNumber, null, "after #100, no more founding numbers are issued");

  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, overflow.id));
  assert.equal(row.foundingMemberNumber, null);
  assert.notEqual(row.isFoundingMember, true);
});
