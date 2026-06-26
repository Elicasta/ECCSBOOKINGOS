export const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const STAGES = {
  INQUIRY_NEW: 'new_inquiry',
  REVIEWING: 'reviewing',
  RESPONDED: 'responded',
  QUOTE_NEEDED: 'quote_needed',
  QUOTE_SENT: 'quote_sent',
  QUOTE_ACCEPTED: 'quote_accepted',
  BOOKING_DRAFT: 'booking_draft',
  RESERVED_DATE_TBD: 'reserved_date_tbd',
  BOOKED: 'booked',
  LOST: 'lost',
  ARCHIVED: 'archived',
};

export const QUOTE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
};

export const CONTRACT_STATUSES = {
  NOT_CREATED: 'not_created',
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  SIGNED: 'signed',
  VOID: 'void',
};

export const INVOICE_STATUSES = {
  NOT_CREATED: 'not_created',
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  VOID: 'void',
};

export const SESSION_TYPES = ['family', 'maternity', 'milestone', 'wedding', 'event', 'branding', 'newborn'];

export function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatMoney(value) {
  return CURRENCY.format(Number(value || 0));
}

export function personName(contact) {
  return [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || contact?.email || 'Unnamed Contact';
}

export function titleCase(value = '') {
  return String(value)
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function cleanEmail(email = '') {
  return String(email).trim().toLowerCase();
}

export function normalizePhone(phone = '') {
  return String(phone).replace(/[^0-9+]/g, '');
}

export function calculateQuoteTotal(items = [], discount = 0) {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    return sum + quantity * unitPrice;
  }, 0);
  const normalizedDiscount = Math.max(0, Number(discount || 0));
  return {
    subtotal,
    discount: normalizedDiscount,
    total: Math.max(0, subtotal - normalizedDiscount),
  };
}

export function computeBookingState({ booking, contract, invoice, appointment }) {
  if (!booking) return null;

  const contractSigned = contract?.status === CONTRACT_STATUSES.SIGNED;
  const invoicePaid = invoice?.status === INVOICE_STATUSES.PAID;
  const dateConfirmed = Boolean(appointment?.startAt && appointment?.confirmed);

  if (contractSigned && invoicePaid && dateConfirmed) return STAGES.BOOKED;
  if (contractSigned && invoicePaid && !dateConfirmed) return STAGES.RESERVED_DATE_TBD;
  if (!contractSigned) return 'contract_pending';
  if (!invoicePaid) return 'payment_pending';
  return 'date_pending';
}

export function createInitialChecklist() {
  return {
    quoteSent: false,
    quoteAccepted: false,
    contractSent: false,
    contractSigned: false,
    invoiceSent: false,
    paymentReceived: false,
    dateConfirmed: false,
  };
}

export function createInquiryFromPayload(payload, existingContactId = null) {
  const timestamp = nowIso();
  const client = payload.client || {};
  const event = payload.event || {};
  const contactId = existingContactId || uid('contact');
  const inquiryId = uid('inq');

  const contact = existingContactId
    ? null
    : {
        id: contactId,
        firstName: client.first_name || client.firstName || '',
        lastName: client.last_name || client.lastName || '',
        email: cleanEmail(client.email),
        phone: normalizePhone(client.phone),
        instagram: client.instagram || '',
        status: 'lead',
        tags: client.returning_client || payload.returningClient ? ['returning'] : [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

  const inquiry = {
    id: inquiryId,
    contactId,
    type: payload.form_type || payload.formType || event.type || 'session',
    status: STAGES.INQUIRY_NEW,
    source: payload.source || 'website',
    preferredDate: event.date || payload.preferredDate || '',
    location: event.location || payload.location || '',
    budgetRange: event.budget || payload.budgetRange || '',
    guestCount: event.guest_count || event.guestCount || '',
    visionSummary: payload.visionSummary || event.vision || '',
    answers: Array.isArray(payload.answers) ? payload.answers : [],
    utm: payload.utm || {},
    metadata: {
      submittedAt: payload.metadata?.submitted_at || payload.metadata?.submittedAt || timestamp,
      isMock: Boolean(payload.metadata?.is_mock || payload.metadata?.isMock),
      rawSource: payload.metadata?.rawSource || '',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return { contact, inquiry };
}

export function validateIncomingInquiry(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('Payload is required.');
  const client = payload?.client || {};
  if (!client.email) errors.push('client.email is required.');
  if (!client.first_name && !client.firstName) errors.push('client.first_name is required.');
  if (!payload?.form_type && !payload?.formType && !payload?.event?.type) errors.push('form_type is required.');
  return errors;
}

export function normalizeIncomingInquiry(payload) {
  return createInquiryFromPayload(payload);
}

export function mergeTemplate(template, context) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path) => {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), context);
    return value == null || value === '' ? '' : String(value);
  });
}

export function createQuote({ inquiry, contact, items, title, note, expiresAt, discount = 0 }) {
  const timestamp = nowIso();
  const totals = calculateQuoteTotal(items, discount);
  return {
    id: uid('quote'),
    inquiryId: inquiry.id,
    contactId: contact.id,
    title: title || `${titleCase(inquiry.type)} Recommendation`,
    status: QUOTE_STATUSES.DRAFT,
    items: items.map((item) => ({ id: item.id || uid('item'), quantity: Number(item.quantity || 1), ...item })),
    discount: totals.discount,
    subtotal: totals.subtotal,
    total: totals.total,
    retainerDue: Math.min(250, totals.total),
    note: note || '',
    expiresAt: expiresAt || '',
    sentAt: null,
    acceptedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createBookingDraft({ inquiry, contact, quote }) {
  const timestamp = nowIso();
  const bookingId = uid('booking');
  return {
    booking: {
      id: bookingId,
      inquiryId: inquiry.id,
      quoteId: quote.id,
      contactId: contact.id,
      title: quote.title,
      status: STAGES.BOOKING_DRAFT,
      checklist: {
        ...createInitialChecklist(),
        quoteSent: true,
        quoteAccepted: true,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    contract: {
      id: uid('contract'),
      bookingId,
      contactId: contact.id,
      status: CONTRACT_STATUSES.DRAFT,
      title: `${quote.title} Contract`,
      externalUrl: '',
      sentAt: null,
      signedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    invoice: {
      id: uid('invoice'),
      bookingId,
      contactId: contact.id,
      quoteId: quote.id,
      status: INVOICE_STATUSES.DRAFT,
      invoiceNumber: `EC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      items: quote.items,
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
      retainerDue: quote.retainerDue,
      amountPaid: 0,
      paymentUrl: '',
      sentAt: null,
      paidAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    appointment: {
      id: uid('appt'),
      bookingId,
      contactId: contact.id,
      startAt: '',
      endAt: '',
      location: inquiry.location || '',
      confirmed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function seedData() {
  const timestamp = nowIso();
  const c1 = {
    id: 'contact_nathalie',
    firstName: 'Nathalie',
    lastName: 'Alonso',
    email: 'nathaliealonso973@example.com',
    phone: '7862267943',
    instagram: '@natvlonso',
    status: 'lead',
    tags: ['returning', 'family'],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const c2 = {
    id: 'contact_kayla',
    firstName: 'Kayla',
    lastName: 'Hernandez',
    email: 'kayla.maria1697@example.com',
    phone: '3055884847',
    instagram: '@kaylahhdz',
    status: 'lead',
    tags: ['graduation'],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const i1 = {
    id: 'inq_nathalie_family',
    contactId: c1.id,
    type: 'family',
    status: STAGES.QUOTE_NEEDED,
    source: 'website',
    preferredDate: '2026-07-13',
    location: 'Outdoors',
    budgetRange: '$550-$650',
    guestCount: '',
    visionSummary: 'Milestone family session with Pinterest inspiration. Returning client.',
    answers: [
      { question: 'What kind of session?', answer: ['Milestone', 'Family'] },
      { question: 'Location?', answer: 'Outdoors' },
      { question: 'How did you hear about us?', answer: 'Returning client ❤️' },
    ],
    utm: { source: 'direct' },
    metadata: { submittedAt: timestamp, isMock: true, rawSource: 'seed' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const i2 = {
    id: 'inq_kayla_grad',
    contactId: c2.id,
    type: 'milestone',
    status: STAGES.INQUIRY_NEW,
    source: 'instagram',
    preferredDate: '2026-07-11',
    location: 'St. Thomas University',
    budgetRange: '$550-$650',
    guestCount: '',
    visionSummary: 'Graduation photos at St. Thomas University.',
    answers: [
      { question: 'What kind of session?', answer: ['Milestone', 'Graduation Photos'] },
      { question: 'Preferred date?', answer: 'July 11, 2026' },
      { question: 'Source?', answer: 'Saw your work on Instagram ✨' },
    ],
    utm: { source: 'instagram' },
    metadata: { submittedAt: timestamp, isMock: true, rawSource: 'seed' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    contacts: [c1, c2],
    inquiries: [i1, i2],
    quotes: [],
    bookings: [],
    contracts: [],
    invoices: [],
    appointments: [],
    communications: [],
    activity: [
      { id: uid('act'), entityType: 'system', entityId: 'seed', message: 'Seed workspace created.', createdAt: timestamp },
    ],
    templates: defaultTemplates(),
  };
}

export function defaultTemplates() {
  return [
    {
      id: 'tpl_warm_response',
      name: 'Warm Inquiry Response',
      type: 'email',
      subject: 'Your EC Creative Studios inquiry',
      body: `Hi {{contact.firstName}},\n\nThank you for reaching out. I read through your inquiry and the vision feels clear: {{inquiry.visionSummary}}\n\nThe next best step is for us to recommend the right session option and secure the date once the quote, contract, and retainer are complete.\n\nI will send the recommendation shortly.\n\nEli\nEC Creative Studios`,
    },
    {
      id: 'tpl_quote_sent',
      name: 'Quote Sent',
      type: 'email',
      subject: 'Your session recommendation is ready',
      body: `Hi {{contact.firstName}},\n\nI prepared your recommendation for {{quote.title}}.\n\nTotal: {{quote.totalFormatted}}\nRetainer due to secure: {{quote.retainerFormatted}}\n\nOnce you accept, the next steps are contract, invoice/payment, and date confirmation.\n\nEli\nEC Creative Studios`,
    },
    {
      id: 'tpl_booking_confirmed',
      name: 'Booking Confirmed',
      type: 'email',
      subject: 'You are officially booked',
      body: `Hi {{contact.firstName}},\n\nYou are officially booked. Your contract is signed, retainer is received, and your date is confirmed.\n\nNext, we will move into planning.\n\nEli\nEC Creative Studios`,
    },
  ];
}
