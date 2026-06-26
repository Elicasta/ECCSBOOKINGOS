# EC Booking OS v1

A narrow admin app for EC Creative Studios.

It receives inquiry data from the client experience, turns the inquiry into a quote, turns an accepted quote into a booking draft, then tracks contract, invoice/payment, and date confirmation until the client is booked.

## Boundary

This is not the marketing site, the client portal, or the marketing automation tool.

```txt
Client Experience → Booking OS
Inquiry → Quote → Accepted Quote → Contract + Invoice + Payment + Date → Booked
```

## Included

- Dashboard focused on work that needs action
- Inquiry inbox
- Contact directory
- Quote builder
- Quote sent / accepted flow
- Booking draft creation
- Contract status tracker
- Invoice/payment status tracker
- Date confirmation tracker
- Computed booking status
- Email template merge and communication log
- Mock inquiry page
- Manual inquiry creation
- Intake receiver contract at `POST /api/inquiries`
- Supabase schema in `supabase/schema.sql`
- Domain tests in `tests/domain.test.mjs`

## Not included on purpose

- Client portal controls
- Marketing campaigns
- DM automation
- Full accounting
- Full e-signature engine
- Payment processing
- Gallery delivery

Those belong in separate apps or later passes.

## Run

```bash
npm install
npm run dev
```

Then open:

```txt
http://localhost:3000
```

## Test

```bash
npm test
npm run build
```

## Production wiring notes

The UI currently persists to `localStorage` so the workflow can be tested without Supabase credentials.

For production, wire these adapters:

1. Replace local state mutations with Supabase queries/mutations.
2. Use the schema in `supabase/schema.sql`.
3. Add authentication.
4. Replace simulated email log with Resend/Postmark send.
5. Connect the client experience to `POST /api/inquiries`.

## Intake payload contract

The client experience should send:

```json
{
  "source": "website",
  "form_type": "family",
  "utm": {
    "source": "instagram",
    "medium": "bio",
    "campaign": "summer"
  },
  "client": {
    "first_name": "Nathalie",
    "last_name": "Alonso",
    "email": "nathalie@example.com",
    "phone": "7862267943",
    "instagram": "@natvlonso"
  },
  "event": {
    "type": "family",
    "date": "2026-07-13",
    "location": "Outdoors",
    "budget": "$550-$650"
  },
  "visionSummary": "Returning client. Family milestone session.",
  "answers": [
    { "question": "What kind of session?", "answer": ["Family", "Milestone"] }
  ],
  "metadata": {
    "is_mock": false,
    "rawSource": "client-experience-v1"
  }
}
```

The app normalizes that into contact + inquiry records.
