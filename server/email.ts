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
