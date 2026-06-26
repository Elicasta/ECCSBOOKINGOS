import { normalizeIncomingInquiry, validateIncomingInquiry } from '../src/lib/domain.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, errors: ['Method not allowed. Use POST.'] });
  }

  try {
    const payload = req.body || {};
    const errors = validateIncomingInquiry(payload);

    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    const normalized = normalizeIncomingInquiry(payload);

    // Production wiring should insert this normalized object into Supabase
    // and send the internal notification email.
    return res.status(201).json({ ok: true, inquiry: normalized });
  } catch (_error) {
    return res.status(400).json({ ok: false, errors: ['Invalid JSON payload.'] });
  }
}
