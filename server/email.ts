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
