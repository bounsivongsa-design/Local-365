// Loaded FIRST by newsletterSendError.test.ts so that environment
// variables captured at module-load time inside newsletter.ts see the
// right value:
//   - RESEND_API_KEY  → present so the route constructs a real Resend
//                       client; api.resend.com fetches are intercepted
//                       in the test. Without this, the route hits the
//                       "[NEWSLETTER SKIPPED] — Resend not configured"
//                       early-return branch instead of the SDK error path
//                       we're trying to guard.
process.env.RESEND_API_KEY = "test_resend_key_xxx";
