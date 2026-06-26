import { NextResponse } from 'next/server';
import { normalizeIncomingInquiry, validateIncomingInquiry } from '../../../src/lib/domain';

export async function POST(request) {
  try {
    const payload = await request.json();
    const errors = validateIncomingInquiry(payload);

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }

    const normalized = normalizeIncomingInquiry(payload);

    // This route is intentionally adapter-shaped.
    // Production wiring should insert the normalized object into Supabase and send the notification email.
    // The UI prototype uses localStorage, so this endpoint returns the exact record shape the admin accepts.
    return NextResponse.json({ ok: true, inquiry: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, errors: ['Invalid JSON payload.'] }, { status: 400 });
  }
}
