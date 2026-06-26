import assert from 'node:assert/strict';
import {
  CONTRACT_STATUSES,
  INVOICE_STATUSES,
  STAGES,
  calculateQuoteTotal,
  computeBookingState,
  createBookingDraft,
  createInquiryFromPayload,
  createQuote,
  mergeTemplate,
} from '../src/lib/domain.js';

const payload = {
  source: 'website',
  form_type: 'family',
  client: { first_name: 'Nathalie', last_name: 'Alonso', email: 'NATHALIE@example.com', phone: '(786) 226-7943' },
  event: { type: 'family', date: '2026-07-13', location: 'Outdoors', budget: '$650' },
  visionSummary: 'Warm family milestone session.',
  answers: [{ question: 'Type', answer: 'Family' }],
  metadata: { is_mock: true },
};

const { contact, inquiry } = createInquiryFromPayload(payload);
assert.equal(contact.email, 'nathalie@example.com');
assert.equal(contact.phone, '7862267943');
assert.equal(inquiry.status, STAGES.INQUIRY_NEW);
assert.equal(inquiry.type, 'family');

const totals = calculateQuoteTotal([
  { quantity: 1, unitPrice: 650 },
  { quantity: 2, unitPrice: 75 },
], 50);
assert.deepEqual(totals, { subtotal: 800, discount: 50, total: 750 });

const quote = createQuote({
  inquiry,
  contact,
  title: 'Family Recommendation',
  items: [{ name: 'Family Session', quantity: 1, unitPrice: 650 }],
});
assert.equal(quote.total, 650);
assert.equal(quote.status, 'draft');

const bundle = createBookingDraft({ inquiry, contact, quote });
assert.equal(bundle.booking.status, STAGES.BOOKING_DRAFT);
assert.equal(bundle.contract.status, CONTRACT_STATUSES.DRAFT);
assert.equal(bundle.invoice.status, INVOICE_STATUSES.DRAFT);

assert.equal(computeBookingState({ booking: bundle.booking, contract: bundle.contract, invoice: bundle.invoice, appointment: bundle.appointment }), 'contract_pending');
assert.equal(computeBookingState({ booking: bundle.booking, contract: { ...bundle.contract, status: CONTRACT_STATUSES.SIGNED }, invoice: { ...bundle.invoice, status: INVOICE_STATUSES.PAID }, appointment: bundle.appointment }), STAGES.RESERVED_DATE_TBD);
assert.equal(computeBookingState({ booking: bundle.booking, contract: { ...bundle.contract, status: CONTRACT_STATUSES.SIGNED }, invoice: { ...bundle.invoice, status: INVOICE_STATUSES.PAID }, appointment: { ...bundle.appointment, startAt: '2026-07-13T16:00', confirmed: true } }), STAGES.BOOKED);

const merged = mergeTemplate('Hi {{contact.firstName}}, total {{quote.total}}', { contact, quote: { total: '$650' } });
assert.equal(merged, 'Hi Nathalie, total $650');

console.log('domain tests passed');
