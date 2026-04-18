import { useEffect } from "react";

const REFERRAL_KEY = "ll365_referral_code";
const REFERRAL_TTL_DAYS = 30;

type Stored = { code: string; at: number };

/**
 * Reads ?ref=CODE from the current URL (anywhere in the app) and
 * stashes it in localStorage so it survives the entire signup
 * journey: landing → membership → Stripe checkout → returning to
 * /create-business. Used by `getStoredReferralCode()` at submit time.
 */
export function useReferralCapture(): void {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (!ref) return;
      const clean = ref.trim().toUpperCase();
      if (!clean || clean.length > 32) return;
      const payload: Stored = { code: clean, at: Date.now() };
      localStorage.setItem(REFERRAL_KEY, JSON.stringify(payload));
    } catch {
      /* localStorage may be blocked in private browsing — ignore */
    }
  }, []);
}

export function getStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(REFERRAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.code) return null;
    const ageDays = (Date.now() - (parsed.at ?? 0)) / (1000 * 60 * 60 * 24);
    if (ageDays > REFERRAL_TTL_DAYS) {
      localStorage.removeItem(REFERRAL_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_KEY);
  } catch {}
}
