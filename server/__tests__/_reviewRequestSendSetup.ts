// Loaded FIRST by reviewRequestSend.test.ts so that environment variables
// captured at module-load time inside the imported route + sms modules
// see the right values:
//   - SMS_PROVIDER=twilio      → providerSend takes the Twilio branch,
//                                which lets us stub success/failure via
//                                fetch interception of api.twilio.com.
//   - TWILIO_*                 → dummy values so the "not configured"
//                                early-return doesn't fire; the actual
//                                HTTP call is intercepted in the test.
//   - RESEND_API_KEY           → present so the route constructs a real
//                                Resend client; api.resend.com fetches
//                                are intercepted in the test.
process.env.SMS_PROVIDER = "twilio";
process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
process.env.TWILIO_AUTH_TOKEN = "test_token";
process.env.TWILIO_PHONE_NUMBER = "+15555550100";
process.env.RESEND_API_KEY = "test_resend_key_xxx";
