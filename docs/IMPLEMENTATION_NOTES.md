# Implementation Notes

## Why this build is intentionally narrow

The previous prototype proved the business flow, but it had too many modules inside one admin shell. This version keeps only what is needed to receive an inquiry and get the client booked.

## Future extraction points

- `POST /api/inquiries` becomes the client experience bridge.
- Email logging becomes real sending through Resend/Postmark.
- Quote acceptance can later become a client-facing hosted quote page.
- Contract can later become internal e-signature.
- Invoice can later become Stripe/QuickBooks/Pixieset integration.
- Booked clients can later create portal access in a separate portal repo.

## Current limitation

This build is functional as a local admin prototype. It is not yet a Supabase-connected production app.
