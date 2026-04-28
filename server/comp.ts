import { eq } from "drizzle-orm";
import { db as pgDb } from "./db";
import { businesses, compMembershipAudit } from "@shared/schema";
import { users } from "@shared/models/auth";

export interface SetCompMembershipResult {
  isCompedMembership: boolean;
  compedMembershipExpiresAt: Date | null;
  recipientEmail: string | null;
  businessName: string;
}

export interface SetCompMembershipOptions {
  bizId: number;
  adminId: string;
  active: boolean;
  note?: string | null;
  expiresAt?: Date | null;
}

/**
 * Grant or revoke an admin comp Gold membership for a business and write
 * the append-only audit row. Returns the resolved recipient email so the
 * caller can hand it to the welcome / revocation email notifier.
 *
 * Used exclusively by the admin POST /api/admin/businesses/:id/comp
 * endpoint. Email side-effects are intentionally NOT performed here so
 * the route can fire-and-forget without blocking on Resend, and so the
 * tests can verify the DB state without stubbing the email module.
 *
 * Returns null when the business does not exist (caller should 404).
 */
export async function setBusinessCompMembership(
  opts: SetCompMembershipOptions,
): Promise<SetCompMembershipResult | null> {
  const expiresAt = opts.expiresAt ?? null;
  const note = opts.note ?? null;

  // Wrap the business update + audit insert in ONE transaction so a
  // failed audit insert rolls back the comp flag flip — never leave the
  // business comped without a corresponding audit row, which would break
  // the append-only "who/when/why" guarantee the audit trail exists for.
  const target = await pgDb.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: businesses.id,
        name: businesses.name,
        email: businesses.email,
        ownerUserId: businesses.ownerUserId,
      })
      .from(businesses)
      .where(eq(businesses.id, opts.bizId));
    if (!row) return null;

    await tx
      .update(businesses)
      .set(
        opts.active
          ? {
              isCompedMembership: true,
              compedMembershipNote: note,
              compedMembershipGrantedAt: new Date(),
              compedMembershipGrantedBy: opts.adminId,
              compedMembershipExpiresAt: expiresAt,
              // Reset reminder flags so a re-grant or expiry-date change
              // gets a fresh round of 7d/1d warning emails.
              compedMembershipReminder7Sent: false,
              compedMembershipReminder1Sent: false,
              // Clear the welcome-sent stamp on grant; the caller's
              // fire-and-forget notifyCompGranted will re-stamp it iff
              // the email actually goes out.
              compedWelcomeEmailSentAt: null,
            }
          : {
              isCompedMembership: false,
              compedMembershipNote: null,
              compedMembershipGrantedAt: null,
              compedMembershipGrantedBy: null,
              compedMembershipExpiresAt: null,
              compedMembershipReminder7Sent: false,
              compedMembershipReminder1Sent: false,
              compedWelcomeEmailSentAt: null,
            },
      )
      .where(eq(businesses.id, opts.bizId));

    // Append-only audit row so the historical "who/when/why" survives
    // even after revoke wipes the live columns on `businesses`.
    await tx.insert(compMembershipAudit).values({
      businessId: opts.bizId,
      action: opts.active ? "grant" : "revoke",
      actorUserId: opts.adminId,
      note,
      expiresAt,
    });

    return row;
  });

  if (!target) return null;

  // Resolve a recipient address (outside the txn — read-only, no need to
  // hold the row lock for it). Prefer the business's own contact email
  // and fall back to the linked owner user's email so a missing
  // business.email still gets the notice through.
  let recipientEmail: string | null = target.email ?? null;
  if (!recipientEmail && target.ownerUserId) {
    const [owner] = await pgDb
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, target.ownerUserId));
    recipientEmail = owner?.email ?? null;
  }

  return {
    isCompedMembership: opts.active,
    compedMembershipExpiresAt: expiresAt,
    recipientEmail,
    businessName: target.name,
  };
}
