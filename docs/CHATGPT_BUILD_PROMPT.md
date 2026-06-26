# Build Prompt: EC Booking OS v1

You are rebuilding the EC Creative Studios admin app as a narrow Booking OS.

Do not continue the old all-in-one CRM direction. Use the old prototype only as reference for proven flow names and actions. Cut marketing, portal, social messaging, email marketing, workflow builder, and client-facing experience modules.

## Product boundary

Build only this path:

```txt
Inquiry → Quote → Quote Accepted → Booking Draft → Contract + Invoice + Payment + Date → Booked
```

The client experience lives outside this app and sends inquiry data to Booking OS. The client portal lives outside this app and opens later.

## Required app sections

- Dashboard
- Inquiries
- Contacts
- Quotes
- Bookings
- Templates
- Dev Tools
- Settings

## Required behavior

1. Inquiry intake
   - Create manual inquiry.
   - Create mock inquiry from presets.
   - Accept normalized payload from `POST /api/inquiries`.
   - Deduplicate contacts by email.
   - Store raw answers.

2. Inquiry detail
   - Show client profile.
   - Show submitted vision and raw answers.
   - Track status.
   - Compose/log email from templates.
   - Build quote.

3. Quote
   - Create quote draft from inquiry.
   - Support line items, subtotal, discount, total, retainer due.
   - Mark sent.
   - Mark accepted.

4. Booking
   - On quote acceptance, create booking draft, contract draft, invoice draft, appointment placeholder.
   - Track contract sent/signed.
   - Track invoice sent/paid.
   - Track date confirmed.
   - Compute booking state.

5. Status rules
   - Quote accepted alone is not booked.
   - Signed contract + paid invoice + no date = `reserved_date_tbd`.
   - Signed contract + paid invoice + confirmed date = `booked`.

6. Communication
   - Use email templates with merge fields.
   - Log outgoing email.
   - Production adapter should send through authenticated domain using Resend/Postmark.

## Data model

Use these entities:

- contacts
- inquiries
- inquiry_answers
- quotes
- quote_items
- bookings
- contracts
- invoices
- appointments
- communications
- templates
- activity_logs

## Implementation notes

- Start with localStorage only if Supabase credentials are not available, but keep function names and schema ready for Supabase.
- Keep admin UI clear, fast, and non-cinematic.
- Do not build portal controls.
- Do not build marketing automation.
- Include tests for the booking state calculation and quote math.
- Include a schema file for Supabase.
