# Paystack Real Test-Key Checklist

Perform this checklist to verify that the end-to-end payment integration flows correctly on your environment using actual test keys from Paystack.

**⚠️ SECURITY WARNING**: Do **NOT** paste secret keys into chats, commit them to git, or use live/production keys for QA. Use **TEST KEYS ONLY**.

## Setup
- [ ] 1. Place your Paystack Test Keys in the local `.env` file (`PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY`).
- [ ] 2. Ensure `PAYSTACK_MOCK_MODE="false"` is set in your `.env`.
- [ ] 3. Ensure `PAYSTACK_TEST_MODE="true"` is set in your `.env`.
- [ ] 4. Start your local server (`npm run dev`).
- [ ] 5. Start `ngrok` (or an equivalent local tunnel) to expose your server to the internet.
- [ ] 6. Copy your public `ngrok` URL and configure the **Test Webhook URL** inside your Paystack Developer Dashboard pointing to `https://<your-ngrok-url>/api/payments/webhook`.

## Execution Script
- [ ] 1. **Start Subscription Checkout**: Attempt to purchase a Pro plan via the UI.
- [ ] 2. **Complete Test Payment**: Use a Paystack test card (e.g., standard success card `4084084084084081`) to complete the payment flow.
- [ ] 3. **Verify Security on Redirect**: Upon successful frontend redirect back to Konn3ct, confirm that access is *not* immediately granted simply because of the frontend redirect. 
- [ ] 4. **Verify Backend Transaction Polling**: Confirm the backend `verify` endpoint successfully talks to Paystack to validate the transaction reference.
- [ ] 5. **Verify Real Webhook Signature**: Check your backend logs to confirm that the incoming webhook from Paystack was securely validated via `crypto.createHmac` matching the test secret.
- [ ] 6. **Confirm Subscription Activation**: Verify the subscription becomes `active` in your database ONLY after the webhook/verify validates the success.
- [ ] 7. **Confirm Abandonment Resilience**: Start a new checkout, but close the Paystack modal without paying. Confirm the subscription remains inactive/abandoned.
- [ ] 8. **Verify Paid Recording Flow**: Navigate to a Paid Recording URL without paying. Confirm it blocks you. Purchase it via Paystack test keys, and confirm the signed S3 URL is returned afterwards.
