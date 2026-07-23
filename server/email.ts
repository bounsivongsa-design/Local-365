import { Resend } from "resend";

const ADMIN_EMAILS = ["boun.sivongsa@gmail.com", "locallist365@gmail.com"];

let resendClient: Resend | null = null;

function getResend() {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("Email not configured: RESEND_API_KEY required");
    return null;
  }
  resendClient = new Resend(apiKey);
  return resendClient;
}

async function sendAdminEmail(subject: string, html: string) {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED] ${subject} — Resend not configured`);
    return;
  }

  try {
    await resend.emails.send({
      from: "Local List 365 <onboarding@resend.dev>",
      to: ADMIN_EMAILS,
      subject,
      html,
    });
    console.log(`[EMAIL SENT] ${subject}`);
  } catch (err: any) {
    console.error(`[EMAIL FAILED] ${subject}:`, err?.message);
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED] Password reset for ${email} — Resend not configured`);
    return false;
  }

  try {
    await resend.emails.send({
      from: "Local List 365 <onboarding@resend.dev>",
      to: [email],
      subject: "Reset Your Password — Local List 365",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0a4a82, #0d5a9e); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">Password Reset Request</h1>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #333; font-size: 15px; line-height: 1.6;">
              We received a request to reset your password for your Local List 365 account. Click the button below to choose a new password.
            </p>
            <div style="margin: 24px 0; text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; background: #0a4a82; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 13px; line-height: 1.5;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't be changed.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px; text-align: center;">
              Local List 365 — Your Moyock Community Directory
            </p>
          </div>
        </div>
      `,
    });
    console.log(`[EMAIL SENT] Password reset for ${email}`);
    return true;
  } catch (err: any) {
    console.error(`[EMAIL FAILED] Password reset for ${email}:`, err?.message);
    return false;
  }
}

export async function notifyAdminNewEvent(eventTitle: string, businessName: string, price: number) {
  const priceFormatted = `$${(price / 100).toFixed(2)}`;
  const subject = `New Event Submitted — ${eventTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0a4a82, #0d5a9e); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">New Event Needs Approval</h1>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;">Event:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #1a1a2e;">${eventTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Business:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${businessName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Payment:</td>
            <td style="padding: 8px 0; color: #8a9a5b; font-weight: bold;">${priceFormatted} — Paid via Stripe</td>
          </tr>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="https://locallist365.replit.app/admin/events" style="display: inline-block; background: #0a4a82; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Review & Approve
          </a>
        </div>
        <p style="margin-top: 16px; font-size: 12px; color: #999; text-align: center;">
          This event will not appear on the public calendar until approved.
        </p>
      </div>
    </div>
  `;
  await sendAdminEmail(subject, html);
}

export async function notifyAdminNewAd(adTitle: string, businessName: string, adSize: string, price: number) {
  const priceFormatted = `$${(price / 100).toFixed(2)}`;
  const sizeLabel = adSize.charAt(0).toUpperCase() + adSize.slice(1);
  const subject = `New Ad Submitted — ${adTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0a4a82, #0d5a9e); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">New Ad Needs Approval</h1>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;">Ad Title:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #1a1a2e;">${adTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Business:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${businessName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Size:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${sizeLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Payment:</td>
            <td style="padding: 8px 0; color: #8a9a5b; font-weight: bold;">${priceFormatted} — Paid via Stripe</td>
          </tr>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="https://locallist365.replit.app/admin" style="display: inline-block; background: #0a4a82; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Review & Approve
          </a>
        </div>
        <p style="margin-top: 16px; font-size: 12px; color: #999; text-align: center;">
          This ad will not go live until approved.
        </p>
      </div>
    </div>
  `;
  await sendAdminEmail(subject, html);
}

/**
 * Tells both sides of a successful referral that they just earned 30 days of
 * Gold features. Sent from server/referrals.ts:processMembershipActivation
 * AFTER the rewards are committed to the DB.
 */
export async function notifyReferralInvoiceCredit(args: {
  referrerEmail: string | null | undefined;
  referrerBusinessName: string;
  referredBusinessName: string;
  creditAmountCents: number;
}) {
  const resend = getResend();
  if (!resend) {
    console.log(
      `[EMAIL SKIPPED] Referral invoice credit (${args.referrerBusinessName} ← ${args.referredBusinessName}) — Resend not configured`,
    );
    return;
  }
  if (!args.referrerEmail) return;

  const dollars = (args.creditAmountCents / 100).toFixed(2);
  const dashboardUrl = "https://locallist365.replit.app/dashboard";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #d4a373, #b8834f); color: white; padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
        <div style="font-size: 14px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; margin-bottom: 8px;">Referral Reward</div>
        <h1 style="margin: 0; font-size: 28px;">$${dollars} Credit Applied</h1>
      </div>
      <div style="background: #f9f9f9; padding: 28px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">Thanks for referring ${args.referredBusinessName}!</h2>
        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          They just completed their first paid month, so we've credited <strong>$${dollars}</strong> to your account — equal to one month of your current membership. The credit will be applied automatically to your next Stripe invoice.
        </p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="${dashboardUrl}" style="display: inline-block; background: #0a4a82; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">View Your Dashboard</a>
        </div>
        <p style="color: #666; font-size: 13px; line-height: 1.5;">Keep referring local businesses — every successful referral earns you another month free.</p>
      </div>
    </div>
  `;
  try {
    await resend.emails.send({
      from: "Local List 365 <onboarding@resend.dev>",
      to: [args.referrerEmail],
      subject: `You earned a $${dollars} credit — thanks for the referral!`,
      html,
    });
    console.log(`[EMAIL SENT] Referral invoice credit → ${args.referrerEmail}`);
  } catch (err: any) {
    console.error(`[EMAIL FAILED] Referral invoice credit:`, err?.message);
  }
}

/**
 * Sent when processReferralOnFirstPaidInvoice rolls a referral row back to
 * 'pending' after a Stripe error. Best-effort — the caller must not let
 * email failures undo the referral state transition.
 */
export async function notifyAdminReferralPayoutFailed(args: {
  referralId: number;
  referrerBusinessId: number;
  referrerBusinessName?: string | null;
  referrerEmail?: string | null;
  referredBusinessId: number;
  referredBusinessName?: string | null;
  referredEmail?: string | null;
  invoiceId?: string | null;
  errorMessage: string;
}) {
  const adminUrl = "https://locallist365.replit.app/admin/referrals?status=pending";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const errSafe = escape(args.errorMessage || "unknown error");
  const referrerLine = `${escape(args.referrerBusinessName || "(unknown)")} <span style="color:#666;">#${args.referrerBusinessId}${args.referrerEmail ? ` · ${escape(args.referrerEmail)}` : ""}</span>`;
  const referredLine = `${escape(args.referredBusinessName || "(unknown)")} <span style="color:#666;">#${args.referredBusinessId}${args.referredEmail ? ` · ${escape(args.referredEmail)}` : ""}</span>`;
  const invoiceLine = args.invoiceId ? escape(args.invoiceId) : "—";

  const subject = `Referral payout FAILED — referral #${args.referralId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #b91c1c, #7f1d1d); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Referral Payout Failed</h1>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">The row was rolled back to 'pending' and will retry on the next webhook delivery.</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 130px;">Referral ID:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #1a1a2e;">#${args.referralId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Referrer:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${referrerLine}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Referred:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${referredLine}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Invoice:</td>
            <td style="padding: 8px 0; color: #1a1a2e; font-family: monospace; font-size: 12px;">${invoiceLine}</td>
          </tr>
        </table>
        <div style="margin-top: 16px; padding: 12px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          <div style="font-size: 12px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Stripe Error</div>
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 13px; color: #7f1d1d; font-family: monospace;">${errSafe}</pre>
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${adminUrl}" style="display: inline-block; background: #0a4a82; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Open Pending Referrals
          </a>
        </div>
      </div>
    </div>
  `;
  await sendAdminEmail(subject, html);
}

export async function notifyReferralRewarded(args: {
  referrerEmail: string | null | undefined;
  referrerBusinessName: string;
  referredEmail: string | null | undefined;
  referredBusinessName: string;
  daysGranted: number;
}) {
  const resend = getResend();
  if (!resend) {
    console.log(
      `[EMAIL SKIPPED] Referral reward (${args.referrerBusinessName} ↔ ${args.referredBusinessName}) — Resend not configured`,
    );
    return;
  }

  const dashboardUrl = "https://locallist365.replit.app/dashboard";

  const buildHtml = (heading: string, body: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #d4a373, #b8834f); color: white; padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
        <div style="font-size: 14px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; margin-bottom: 8px;">Reward Unlocked</div>
        <h1 style="margin: 0; font-size: 28px;">+${args.daysGranted} Days of Gold</h1>
      </div>
      <div style="background: #f9f9f9; padding: 28px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">${heading}</h2>
        <p style="color: #333; font-size: 15px; line-height: 1.6;">${body}</p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="${dashboardUrl}" style="display: inline-block; background: #0a4a82; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            View Your Dashboard
          </a>
        </div>
        <p style="color: #666; font-size: 13px; line-height: 1.5;">
          Your Gold features are active immediately and will remain so until your bonus window expires. Keep referring local businesses to keep stacking days — no limit.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">
          Local List 365 — Your Moyock Community Directory
        </p>
      </div>
    </div>
  `;

  const sends: Promise<unknown>[] = [];

  if (args.referrerEmail) {
    sends.push(
      resend.emails
        .send({
          from: "Local List 365 <onboarding@resend.dev>",
          to: [args.referrerEmail],
          subject: `You earned +${args.daysGranted} days of Gold — thanks for the referral!`,
          html: buildHtml(
            `Thanks for bringing ${args.referredBusinessName} to LocalList365!`,
            `Your referral just activated their paid membership. You both get <strong>${args.daysGranted} free days of Gold</strong> features added to your account, starting now.`,
          ),
        })
        .then(() => console.log(`[EMAIL SENT] Referral reward → ${args.referrerEmail}`))
        .catch((err: any) =>
          console.error(`[EMAIL FAILED] Referral reward to referrer:`, err?.message),
        ),
    );
  }

  if (args.referredEmail) {
    sends.push(
      resend.emails
        .send({
          from: "Local List 365 <onboarding@resend.dev>",
          to: [args.referredEmail],
          subject: `Welcome bonus: +${args.daysGranted} days of Gold on us`,
          html: buildHtml(
            `Welcome to LocalList365, ${args.referredBusinessName}!`,
            `You signed up using a referral code from <strong>${args.referrerBusinessName}</strong>, so we've added <strong>${args.daysGranted} free days of Gold</strong> features to your account on top of your plan. Enjoy.`,
          ),
        })
        .then(() => console.log(`[EMAIL SENT] Referral welcome → ${args.referredEmail}`))
        .catch((err: any) =>
          console.error(`[EMAIL FAILED] Referral welcome to referred:`, err?.message),
        ),
    );
  }

  await Promise.allSettled(sends);
}

/**
 * Comp-membership notifications. Sent from the admin grant/revoke endpoint
 * and from the periodic expiry sweep so recipients aren't surprised when
 * their free Gold access toggles. All four flows reuse the same Resend
 * sender as every other transactional email here.
 */
function formatExpiryDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const COMP_DASHBOARD_URL = "https://locallist365.replit.app/dashboard";

function buildCompShell(headerLabel: string, heading: string, bodyHtml: string, ctaLabel = "View Your Dashboard") {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #d4a373, #b8834f); color: white; padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
        <div style="font-size: 14px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; margin-bottom: 8px;">${headerLabel}</div>
        <h1 style="margin: 0; font-size: 26px;">${heading}</h1>
      </div>
      <div style="background: #f9f9f9; padding: 28px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        ${bodyHtml}
        <div style="margin: 24px 0; text-align: center;">
          <a href="${COMP_DASHBOARD_URL}" style="display: inline-block; background: #0a4a82; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            ${ctaLabel}
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">
          Local List 365 — Your Moyock Community Directory
        </p>
      </div>
    </div>
  `;
}

async function sendCompEmail(args: { to: string; subject: string; html: string; logLabel: string }) {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED] ${args.logLabel} → ${args.to} — Resend not configured`);
    return false;
  }
  try {
    await resend.emails.send({
      from: "Local List 365 <onboarding@resend.dev>",
      to: [args.to],
      subject: args.subject,
      html: args.html,
    });
    console.log(`[EMAIL SENT] ${args.logLabel} → ${args.to}`);
    return true;
  } catch (err: any) {
    console.error(`[EMAIL FAILED] ${args.logLabel} → ${args.to}:`, err?.message);
    return false;
  }
}

export async function notifyCompGranted(args: {
  recipientEmail: string | null | undefined;
  businessName: string;
  expiresAt: Date | string | null;
  note?: string | null;
}): Promise<boolean> {
  if (!args.recipientEmail) {
    console.log(`[EMAIL SKIPPED] Comp grant — no recipient email for ${args.businessName}`);
    return false;
  }
  const expiryLine = args.expiresAt
    ? `<p style="color: #333; font-size: 15px; line-height: 1.6;">Your free Gold access is active through <strong>${formatExpiryDate(args.expiresAt)}</strong>. We'll send you a friendly reminder before it ends so nothing changes silently.</p>`
    : `<p style="color: #333; font-size: 15px; line-height: 1.6;">Your free Gold access has no expiration date — enjoy it for as long as we keep the lights on.</p>`;
  const body = `
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">${args.businessName}, you've been comped a free Gold membership!</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      Our team just unlocked Gold-tier features on your listing — featured placement, extra photos, the newsletter tool, AI helpers, and the rest of the Gold lineup. There's nothing to pay and no card required.
    </p>
    ${expiryLine}
  `;
  return sendCompEmail({
    to: args.recipientEmail,
    subject: `You've been given a free Gold membership on Local List 365`,
    html: buildCompShell("Gold Unlocked", "Free Gold Membership Activated", body),
    logLabel: "Comp grant",
  });
}

export async function notifyCompExpiring(args: {
  recipientEmail: string | null | undefined;
  businessName: string;
  expiresAt: Date | string;
  daysRemaining: 7 | 1;
}): Promise<boolean> {
  if (!args.recipientEmail) {
    console.log(`[EMAIL SKIPPED] Comp expiring ${args.daysRemaining}d — no recipient email for ${args.businessName}`);
    return false;
  }
  const dayWord = args.daysRemaining === 1 ? "tomorrow" : `in ${args.daysRemaining} days`;
  const body = `
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">Heads up, ${args.businessName} — your free Gold ends ${dayWord}.</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      Your complimentary Gold membership is scheduled to expire on <strong>${formatExpiryDate(args.expiresAt)}</strong>. After that, your listing will go back to its normal tier and Gold-only features (featured placement, newsletter, extra photos, AI tools) will switch off.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      Want to keep Gold? You can upgrade from your dashboard in a couple of clicks, or reply to this email and we'll help you out.
    </p>
  `;
  return sendCompEmail({
    to: args.recipientEmail,
    subject: `Your free Gold membership ends ${dayWord} — ${args.businessName}`,
    html: buildCompShell(
      args.daysRemaining === 1 ? "Final Reminder" : "Friendly Reminder",
      args.daysRemaining === 1 ? "Free Gold Ends Tomorrow" : "Free Gold Ends in 7 Days",
      body,
      "Upgrade or Manage Membership",
    ),
    logLabel: `Comp expiring ${args.daysRemaining}d`,
  });
}

export async function notifyCompRevoked(args: {
  recipientEmail: string | null | undefined;
  businessName: string;
}): Promise<boolean> {
  if (!args.recipientEmail) {
    console.log(`[EMAIL SKIPPED] Comp revoke — no recipient email for ${args.businessName}`);
    return false;
  }
  const body = `
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">Your free Gold access on ${args.businessName} has ended.</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      We wanted to let you know our team has ended the complimentary Gold membership on your listing. Your business is still live — it just goes back to its regular plan and Gold-only features will turn off.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      If you'd like to keep Gold features, you can upgrade anytime from your dashboard. Questions? Just reply to this email.
    </p>
  `;
  return sendCompEmail({
    to: args.recipientEmail,
    subject: `Update on your Local List 365 membership — ${args.businessName}`,
    html: buildCompShell("Membership Update", "Comp Gold Membership Ended", body, "Manage Your Membership"),
    logLabel: "Comp revoke",
  });
}

/**
 * One-time notification to a comp recipient when their complimentary Gold
 * access has just expired and the system auto-reverted them back to whatever
 * paid tier (or none) they were on before. Best-effort — failures are logged
 * but never block the underlying state change.
 *
 * Distinct from `notifyCompRevoked` (admin-initiated) and `notifyCompExpiring`
 * (heads-up before expiry): this one fires after the auto-revert sweep flips
 * `isCompedMembership` to false on its own.
 */
export async function notifyOwnerCompExpired(args: {
  ownerEmail: string | null | undefined;
  businessName: string;
  revertedToTier: string;
}): Promise<boolean> {
  if (!args.ownerEmail) {
    console.log(
      `[EMAIL SKIPPED] Comp expired (${args.businessName}) — no owner email on file`,
    );
    return false;
  }
  const tierLabel =
    args.revertedToTier === "premium"
      ? "Gold"
      : args.revertedToTier === "standard"
        ? "Silver"
        : args.revertedToTier === "basic"
          ? "Bronze"
          : "Free";
  const body = `
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">Hi ${args.businessName},</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      Your complimentary Gold access on Local List 365 has reached its expiration date. We've reverted <strong>${args.businessName}</strong> back to your previous plan (<strong>${tierLabel}</strong>), and Gold-only features are no longer available on this listing.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      If you'd like to keep using AI tools, deals, social composer, and other Gold benefits, you can upgrade anytime from your dashboard.
    </p>
  `;
  return sendCompEmail({
    to: args.ownerEmail,
    subject: `Your complimentary Gold access has ended — ${args.businessName}`,
    html: buildCompShell("Complimentary Access", "Your Free Gold Access Has Ended", body, "Open Dashboard"),
    logLabel: "Comp expired",
  });
}

/**
 * Nudge someone who paid for a membership tier at checkout but never came
 * back to finish creating their actual business listing — without this,
 * they'd just keep getting charged for a plan that's doing nothing for
 * them. Sent once (gated by users.pendingReminderSent) a few days into the
 * pending window, before checkAbandonedBusinessCheckouts auto-cancels.
 */
export async function notifyAbandonedCheckoutReminder(args: {
  recipientEmail: string | null | undefined;
  firstName?: string | null;
}): Promise<boolean> {
  if (!args.recipientEmail) {
    console.log(`[EMAIL SKIPPED] Abandoned checkout reminder — no recipient email`);
    return false;
  }
  const greeting = args.firstName ? `Hi ${args.firstName},` : "Hi there,";
  const body = `
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">${greeting}</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      You started a business membership on Local List 365, but never finished setting up your actual listing (business name, category, photos, description). Your card is being charged for the plan, but nothing is live yet — no one can find or see your business.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      It only takes a couple of minutes to finish. If we don't hear back soon, we'll cancel the subscription automatically so you're not paying for a listing that was never created.
    </p>
  `;
  return sendCompEmail({
    to: args.recipientEmail,
    subject: "Finish setting up your Local List 365 business listing",
    html: buildCompShell("Action Needed", "Finish Your Business Listing", body, "Finish My Listing"),
    logLabel: "Abandoned checkout reminder",
  });
}

/**
 * Sent when checkAbandonedBusinessCheckouts auto-cancels a subscription for
 * someone who never finished their listing, so the cancellation isn't a
 * silent surprise — tells them plainly what happened and how to restart if
 * they still want in.
 */
export async function notifyAbandonedCheckoutCancelled(args: {
  recipientEmail: string | null | undefined;
  firstName?: string | null;
}): Promise<boolean> {
  if (!args.recipientEmail) {
    console.log(`[EMAIL SKIPPED] Abandoned checkout cancelled — no recipient email`);
    return false;
  }
  const greeting = args.firstName ? `Hi ${args.firstName},` : "Hi there,";
  const body = `
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1a1a2e;">${greeting}</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      A while back you started a business membership on Local List 365 but never finished creating your listing, so we've cancelled the subscription — you won't be charged for it going forward.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">
      Still want a listing? You're welcome to sign up again any time — it just takes a couple of minutes to finish once you pick a plan.
    </p>
  `;
  return sendCompEmail({
    to: args.recipientEmail,
    subject: "Your incomplete Local List 365 membership was cancelled",
    html: buildCompShell("Subscription Cancelled", "Membership Cancelled — Listing Never Finished", body, "Sign Up Again"),
    logLabel: "Abandoned checkout cancelled",
  });
}

/**
 * Alert admins when a business's recent review-request blast bounce rate
 * crosses the configured safe threshold. Returns true on a successful send
 * (used by the caller to decide whether to persist a cooldown row), false
 * if Resend is not configured or the send threw.
 */
export async function notifyAdminBounceRateSpike(args: {
  businessId: number;
  businessName: string;
  bounceCount: number;
  totalCount: number;
  bounceRatePct: number; // 0-100
  thresholdPct: number; // 0-100
  windowHours: number;
  sampleSize: number;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log(
      `[EMAIL SKIPPED] Bounce-rate spike for business #${args.businessId} (${args.businessName}) — Resend not configured`,
    );
    return false;
  }

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const adminUrl = `https://locallist365.replit.app/admin?business=${args.businessId}`;
  const requestsUrl = `https://locallist365.replit.app/admin/businesses/${args.businessId}/review-requests`;
  const ratePretty = args.bounceRatePct.toFixed(1);
  const thresholdPretty = args.thresholdPct.toFixed(0);

  const subject = `Bounce-rate spike: ${escape(args.businessName)} at ${ratePretty}%`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #b91c1c, #7f1d1d); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Sender-Reputation Warning</h1>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">A business's review-request blasts are bouncing above the safe threshold.</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 160px;">Business:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #1a1a2e;">${escape(args.businessName)} <span style="color:#666; font-weight: normal;">#${args.businessId}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Bounce rate:</td>
            <td style="padding: 8px 0; color: #b91c1c; font-weight: bold;">${ratePretty}% <span style="color:#666; font-weight: normal;">(threshold ${thresholdPretty}%)</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Sample:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${args.bounceCount} of last ${args.totalCount} email sends in the past ${args.windowHours}h <span style="color:#666;">(cap: ${args.sampleSize})</span></td>
          </tr>
        </table>
        <div style="margin-top: 16px; padding: 12px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; color: #7f1d1d;">
          Continued sending at this rate risks Resend throttling our shared domain. Review the offender's recipient list and consider pausing their blasts or clearing stale contacts before the next send.
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${requestsUrl}" style="display: inline-block; background: #b91c1c; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 8px;">View Review Requests</a>
          <a href="${adminUrl}" style="display: inline-block; background: #0a4a82; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Business</a>
        </div>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Local List 365 <onboarding@resend.dev>",
      to: ADMIN_EMAILS,
      subject,
      html,
    });
    console.log(`[EMAIL SENT] ${subject}`);
    return true;
  } catch (err: any) {
    console.error(`[EMAIL FAILED] ${subject}:`, err?.message);
    return false;
  }
}

/**
 * Heads-up email to a business owner when their review-request blast
 * produced a sudden cluster of webhook-confirmed permanent bounces in the
 * last 24h. Distinct from `notifyAdminBounceRateSpike` (admin-only,
 * %-based, sender-reputation warning) — this one tells the OWNER that the
 * specific imported list they just sent was full of stale addresses, with a
 * direct link to clean things up. Returns true on a successful send so the
 * caller can persist a cooldown row and avoid re-alerting tomorrow.
 */
export async function notifyOwnerBounceSpike(args: {
  recipientEmail: string | null | undefined;
  businessName: string;
  bounceCount: number;
  windowHours: number;
}): Promise<boolean> {
  if (!args.recipientEmail) {
    console.log(
      `[EMAIL SKIPPED] Bounce spike for ${args.businessName} — no owner email on file`,
    );
    return false;
  }
  const resend = getResend();
  if (!resend) {
    console.log(
      `[EMAIL SKIPPED] Bounce spike for ${args.businessName} — Resend not configured`,
    );
    return false;
  }

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const reviewRequestsUrl = "https://locallist365.replit.app/review-requests";
  const subject = `Heads up: ${args.bounceCount} review-request bounces in the last ${args.windowHours}h`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #b45309, #92400e); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Bounce spike on your review requests</h1>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">A cluster of recent sends came back undeliverable.</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin-top: 0;">
          Hi ${escape(args.businessName)},
        </p>
        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          We noticed <strong>${args.bounceCount} permanent bounces</strong> on your review-request blasts in the last ${args.windowHours} hours. That usually means an imported customer list has stale or mistyped email addresses — those recipients won't get your follow-up, and continuing to send to them can hurt deliverability for the addresses that <em>are</em> good.
        </p>
        <div style="margin-top: 16px; padding: 12px 14px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; color: #78350f;">
          Open the Review Requests page to see which addresses bounced and clean them up before your next send.
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${reviewRequestsUrl}" style="display: inline-block; background: #b45309; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Review Requests</a>
        </div>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Local List 365 <onboarding@resend.dev>",
      to: [args.recipientEmail],
      subject,
      html,
    });
    console.log(`[EMAIL SENT] ${subject} -> ${args.recipientEmail}`);
    return true;
  } catch (err: any) {
    console.error(`[EMAIL FAILED] ${subject}:`, err?.message);
    return false;
  }
}

// Notify a business owner that an admin sent them a direct message.
// Throttling (max one per N hours per business) is enforced by the caller in
// server/routes.ts before invoking this — we just send unconditionally here.
export async function notifyOwnerOfAdminMessage(args: {
  ownerEmail: string;
  businessName: string;
  body: string;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log(
      `[EMAIL SKIPPED] Admin DM to ${args.ownerEmail} (${args.businessName}) — Resend not configured`,
    );
    return false;
  }

  const safeBody = args.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  try {
    await resend.emails.send({
      from: "Local List 365 <onboarding@resend.dev>",
      to: [args.ownerEmail],
      subject: `Message from Local List 365 admin — ${args.businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0a4a82, #0d5a9e); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">New message from the admin team</h1>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">For ${args.businessName}</p>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="background: white; border-left: 3px solid #0a4a82; padding: 14px 16px; border-radius: 6px; color: #1a1a2e; font-size: 14px; line-height: 1.55;">
              ${safeBody}
            </div>
            <div style="margin-top: 22px; text-align: center;">
              <a href="https://locallist365.replit.app/dashboard" style="display: inline-block; background: #0a4a82; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Reply in your dashboard
              </a>
            </div>
            <p style="margin-top: 18px; font-size: 12px; color: #888; line-height: 1.5;">
              You're getting this because the Local List 365 admin team sent your business a message. To avoid spamming you, follow-up admin messages within the next few hours won't trigger a second email — open your dashboard inbox to see them.
            </p>
          </div>
        </div>
      `,
    });
    console.log(`[EMAIL SENT] Admin DM -> ${args.ownerEmail} (${args.businessName})`);
    return true;
  } catch (err: any) {
    console.error(`[EMAIL FAILED] Admin DM -> ${args.ownerEmail}:`, err?.message);
    return false;
  }
}

export async function notifyAdminGithubSyncFailed(errorMessage: string) {
  const safeError = errorMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 2000);
  const subject = "⚠️ GitHub Backup Push Failed — Local List 365";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #b91c1c, #dc2626); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">GitHub Backup Push Failed</h1>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          The automatic push of the project to GitHub failed. The GitHub backup may start falling behind until this is fixed.
        </p>
        <p style="color: #333; font-size: 14px; line-height: 1.6;">
          Common causes: the <strong>GITHUB_TOKEN</strong> secret expired or was revoked, or the token is missing the <strong>workflow</strong> scope (required because the repo history contains GitHub Actions files).
        </p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <pre style="margin: 0; font-size: 12px; color: #7f1d1d; white-space: pre-wrap; word-break: break-word;">${safeError}</pre>
        </div>
        <p style="color: #666; font-size: 13px;">
          This alert is rate-limited to once every 24 hours. The sync retries hourly and will stop alerting once a push succeeds.
        </p>
      </div>
    </div>
  `;
  await sendAdminEmail(subject, html);
}

export async function notifyAdminNewBusiness(businessName: string, ownerEmail: string, tier: string) {
  const tierLabel = tier === "premium" ? "Gold" : tier === "standard" ? "Silver" : tier === "basic" ? "Bronze" : tier;
  const subject = `New Business Registered — ${businessName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0a4a82, #0d5a9e); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">New Business Registration</h1>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;">Business:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #1a1a2e;">${businessName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Owner Email:</td>
            <td style="padding: 8px 0; color: #1a1a2e;">${ownerEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Plan:</td>
            <td style="padding: 8px 0; color: #d4a373; font-weight: bold;">${tierLabel}</td>
          </tr>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="https://locallist365.replit.app/admin" style="display: inline-block; background: #0a4a82; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View in Admin
          </a>
        </div>
      </div>
    </div>
  `;
  await sendAdminEmail(subject, html);
}
