import { useEffect, useMemo, useState } from 'react';
import {
  CONTRACT_STATUSES,
  INVOICE_STATUSES,
  QUOTE_STATUSES,
  STAGES,
  calculateQuoteTotal,
  computeBookingState,
  createBookingDraft,
  createInquiryFromPayload,
  createQuote,
  defaultTemplates,
  formatMoney,
  mergeTemplate,
  nowIso,
  personName,
  seedData,
  titleCase,
  uid,
} from '../lib/domain';

const STORAGE_KEY = 'ec-booking-os-v1';

const navItems = [
  ['dashboard', 'Dashboard'],
  ['inquiries', 'Inquiries'],
  ['quotes', 'Quotes'],
  ['bookings', 'Bookings'],
  ['contacts', 'Contacts'],
  ['templates', 'Templates'],
  ['dev', 'Dev Tools'],
  ['settings', 'Settings'],
];

function normalizeStore(candidate) {
  const seed = seedData();
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  return {
    ...seed,
    ...source,
    contacts: Array.isArray(source.contacts) ? source.contacts : seed.contacts,
    inquiries: Array.isArray(source.inquiries) ? source.inquiries : seed.inquiries,
    quotes: Array.isArray(source.quotes) ? source.quotes : seed.quotes,
    bookings: Array.isArray(source.bookings) ? source.bookings : seed.bookings,
    contracts: Array.isArray(source.contracts) ? source.contracts : seed.contracts,
    invoices: Array.isArray(source.invoices) ? source.invoices : seed.invoices,
    appointments: Array.isArray(source.appointments) ? source.appointments : seed.appointments,
    communications: Array.isArray(source.communications) ? source.communications : seed.communications,
    activity: Array.isArray(source.activity) ? source.activity : seed.activity,
    templates: Array.isArray(source.templates) && source.templates.length ? source.templates : defaultTemplates(),
  };
}

function loadStore() {
  if (typeof window === 'undefined') return seedData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    return normalizeStore(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return seedData();
  }
}

function saveStore(store) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

export default function BookingOS() {
  const [store, setStore] = useState(loadStore);
  const safeStore = normalizeStore(store);
  const [active, setActive] = useState('dashboard');
  const [selectedInquiryId, setSelectedInquiryId] = useState(safeStore.inquiries[0]?.id || null);
  const [selectedContactId, setSelectedContactId] = useState(safeStore.contacts[0]?.id || null);
  const [selectedBookingId, setSelectedBookingId] = useState(safeStore.bookings[0]?.id || null);
  const [selectedQuoteId, setSelectedQuoteId] = useState(safeStore.quotes[0]?.id || null);
  const [toast, setToast] = useState('');

  useEffect(() => saveStore(safeStore), [safeStore]);

  function flash(message) {
    setToast(message);
    window.clearTimeout(window.__ecBookingToast);
    window.__ecBookingToast = window.setTimeout(() => setToast(''), 2600);
  }

  function patchStore(updater, message) {
    setStore((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return next;
    });
    if (message) flash(message);
  }

  function addActivity(current, entityType, entityId, message) {
    return {
      ...current,
      activity: [{ id: uid('act'), entityType, entityId, message, createdAt: nowIso() }, ...current.activity],
    };
  }

  function createManualInquiry(payload) {
    patchStore((current) => {
      const existing = current.contacts.find((c) => c.email === payload.client.email.toLowerCase());
      const { contact, inquiry } = createInquiryFromPayload(payload, existing?.id);
      const next = {
        ...current,
        contacts: contact ? [contact, ...current.contacts] : current.contacts,
        inquiries: [inquiry, ...current.inquiries],
      };
      setSelectedInquiryId(inquiry.id);
      setActive('inquiries');
      return addActivity(next, 'inquiry', inquiry.id, `${existing ? 'Attached' : 'Created'} inquiry for ${payload.client.first_name}.`);
    }, 'Inquiry created.');
  }

  function updateInquiry(id, patch) {
    patchStore((current) => addActivity({
      ...current,
      inquiries: current.inquiries.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: nowIso() } : i)),
    }, 'inquiry', id, `Inquiry updated: ${Object.keys(patch).join(', ')}`));
  }

  function buildQuoteForInquiry(inquiry, contact, draft) {
    patchStore((current) => {
      const quote = createQuote({ inquiry, contact, ...draft });
      setSelectedQuoteId(quote.id);
      const next = {
        ...current,
        quotes: [quote, ...current.quotes],
        inquiries: current.inquiries.map((i) => (i.id === inquiry.id ? { ...i, status: STAGES.QUOTE_NEEDED, updatedAt: nowIso() } : i)),
      };
      return addActivity(next, 'quote', quote.id, `Quote drafted for ${personName(contact)}.`);
    }, 'Quote drafted.');
  }

  function sendQuote(quoteId) {
    patchStore((current) => {
      const quote = current.quotes.find((q) => q.id === quoteId);
      const inquiry = current.inquiries.find((i) => i.id === quote?.inquiryId);
      const next = {
        ...current,
        quotes: current.quotes.map((q) => (q.id === quoteId ? { ...q, status: QUOTE_STATUSES.SENT, sentAt: nowIso(), updatedAt: nowIso() } : q)),
        inquiries: current.inquiries.map((i) => (i.id === inquiry?.id ? { ...i, status: STAGES.QUOTE_SENT, updatedAt: nowIso() } : i)),
      };
      return addActivity(next, 'quote', quoteId, 'Quote marked sent.');
    }, 'Quote sent/logged.');
  }

  function acceptQuote(quoteId) {
    patchStore((current) => {
      const quote = current.quotes.find((q) => q.id === quoteId);
      const inquiry = current.inquiries.find((i) => i.id === quote?.inquiryId);
      const contact = current.contacts.find((c) => c.id === quote?.contactId);
      if (!quote || !inquiry || !contact) return current;
      const existingBooking = current.bookings.find((b) => b.quoteId === quote.id);
      if (existingBooking) {
        setSelectedBookingId(existingBooking.id);
        setActive('bookings');
        return current;
      }
      const bundle = createBookingDraft({ inquiry, contact, quote: { ...quote, status: QUOTE_STATUSES.ACCEPTED } });
      setSelectedBookingId(bundle.booking.id);
      setActive('bookings');
      const next = {
        ...current,
        quotes: current.quotes.map((q) => (q.id === quoteId ? { ...q, status: QUOTE_STATUSES.ACCEPTED, acceptedAt: nowIso(), updatedAt: nowIso() } : q)),
        inquiries: current.inquiries.map((i) => (i.id === inquiry.id ? { ...i, status: STAGES.BOOKING_DRAFT, updatedAt: nowIso() } : i)),
        bookings: [bundle.booking, ...current.bookings],
        contracts: [bundle.contract, ...current.contracts],
        invoices: [bundle.invoice, ...current.invoices],
        appointments: [bundle.appointment, ...current.appointments],
        contacts: current.contacts.map((c) => (c.id === contact.id ? { ...c, status: 'active_client', updatedAt: nowIso() } : c)),
      };
      return addActivity(next, 'booking', bundle.booking.id, 'Quote accepted. Booking draft, contract draft, and invoice draft created.');
    }, 'Quote accepted. Booking draft created.');
  }

  function updateBookingAsset(kind, id, patch) {
    const key = `${kind}s`;
    patchStore((current) => {
      const next = {
        ...current,
        [key]: current[key].map((item) => (item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item)),
      };
      return addActivity(next, kind, id, `${titleCase(kind)} updated.`);
    }, `${titleCase(kind)} updated.`);
  }

  function refreshBookingStatus(bookingId) {
    patchStore((current) => {
      const booking = current.bookings.find((b) => b.id === bookingId);
      const contract = current.contracts.find((c) => c.bookingId === bookingId);
      const invoice = current.invoices.find((i) => i.bookingId === bookingId);
      const appointment = current.appointments.find((a) => a.bookingId === bookingId);
      const computed = computeBookingState({ booking, contract, invoice, appointment });
      const checklist = {
        quoteSent: true,
        quoteAccepted: true,
        contractSent: contract?.status === CONTRACT_STATUSES.SENT || contract?.status === CONTRACT_STATUSES.SIGNED,
        contractSigned: contract?.status === CONTRACT_STATUSES.SIGNED,
        invoiceSent: invoice?.status === INVOICE_STATUSES.SENT || invoice?.status === INVOICE_STATUSES.PAID || invoice?.status === INVOICE_STATUSES.PARTIALLY_PAID,
        paymentReceived: invoice?.status === INVOICE_STATUSES.PAID,
        dateConfirmed: Boolean(appointment?.confirmed && appointment?.startAt),
      };
      return addActivity({
        ...current,
        bookings: current.bookings.map((b) => (b.id === bookingId ? { ...b, status: computed, checklist, updatedAt: nowIso() } : b)),
        inquiries: current.inquiries.map((inq) => (inq.id === booking?.inquiryId ? { ...inq, status: computed === STAGES.BOOKED ? STAGES.BOOKED : inq.status, updatedAt: nowIso() } : inq)),
      }, 'booking', bookingId, `Booking status recalculated: ${titleCase(computed)}.`);
    }, 'Booking status refreshed.');
  }

  function sendEmailLog({ contact, inquiry, quote, templateId, body, subject }) {
    patchStore((current) => {
      const communication = {
        id: uid('comm'),
        contactId: contact.id,
        inquiryId: inquiry?.id || null,
        type: 'email',
        direction: 'outbound',
        subject,
        body,
        status: 'simulated_sent',
        createdAt: nowIso(),
      };
      const next = { ...current, communications: [communication, ...current.communications] };
      return addActivity(next, 'communication', communication.id, `Email logged to ${personName(contact)}.`);
    }, 'Email logged. Wire Resend when env vars are ready.');
  }

  function resetWorkspace() {
    const seeded = seedData();
    setStore(seeded);
    setSelectedInquiryId(seeded.inquiries[0]?.id || null);
    setSelectedContactId(seeded.contacts[0]?.id || null);
    setSelectedBookingId(null);
    setSelectedQuoteId(null);
    setActive('dashboard');
    flash('Workspace reset.');
  }

  const context = { store: safeStore, active, setActive, selectedInquiryId, setSelectedInquiryId, selectedContactId, setSelectedContactId, selectedBookingId, setSelectedBookingId, selectedQuoteId, setSelectedQuoteId, createManualInquiry, updateInquiry, buildQuoteForInquiry, sendQuote, acceptQuote, updateBookingAsset, refreshBookingStatus, sendEmailLog, resetWorkspace };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandMark">EC</div>
          <div>
            <p className="eyebrow">EC Creative Studios</p>
            <h1>Booking OS</h1>
          </div>
        </div>
        <nav>
          {navItems.map(([id, label]) => (
            <button key={id} className={active === id ? 'navItem active' : 'navItem'} onClick={() => setActive(id)}>{label}</button>
          ))}
        </nav>
        <div className="sidebarFooter">
          <p>Build boundary</p>
          <strong>Inquiry → Quote → Booking</strong>
          <span>No marketing suite. No portal controls.</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Admin workspace</p>
            <h2>{navItems.find(([id]) => id === active)?.[1]}</h2>
          </div>
          <div className="topActions">
            <button className="ghost" onClick={() => setActive('dev')}>Create Mock Inquiry</button>
            <button className="primary" onClick={() => setActive('inquiries')}>Open Inbox</button>
          </div>
        </header>

        {toast && <div className="toast">{toast}</div>}

        {active === 'dashboard' && <Dashboard {...context} />}
        {active === 'inquiries' && <Inquiries {...context} />}
        {active === 'quotes' && <Quotes {...context} />}
        {active === 'bookings' && <Bookings {...context} />}
        {active === 'contacts' && <Contacts {...context} />}
        {active === 'templates' && <Templates {...context} />}
        {active === 'dev' && <DevTools {...context} />}
        {active === 'settings' && <Settings />}
      </main>
    </div>
  );
}

function Dashboard({ store, setActive, setSelectedInquiryId, setSelectedBookingId }) {
  const stats = useMemo(() => {
    const newInquiries = store.inquiries.filter((i) => i.status === STAGES.INQUIRY_NEW).length;
    const quoteOut = store.quotes.filter((q) => q.status === QUOTE_STATUSES.SENT).length;
    const almost = store.bookings.filter((b) => b.status !== STAGES.BOOKED).length;
    const booked = store.bookings.filter((b) => b.status === STAGES.BOOKED).length;
    return { newInquiries, quoteOut, almost, booked };
  }, [store]);
  const needsAction = store.inquiries.filter((i) => [STAGES.INQUIRY_NEW, STAGES.QUOTE_NEEDED, STAGES.QUOTE_SENT].includes(i.status)).slice(0, 5);
  const almostBooked = store.bookings.filter((b) => b.status !== STAGES.BOOKED).slice(0, 5);

  return (
    <section className="stack">
      <div className="grid4">
        <Metric label="New inquiries" value={stats.newInquiries} />
        <Metric label="Quotes out" value={stats.quoteOut} />
        <Metric label="Almost booked" value={stats.almost} />
        <Metric label="Booked" value={stats.booked} />
      </div>
      <div className="twoCol">
        <Panel title="Needs attention" subtitle="The dashboard is not vanity. It shows who needs action.">
          {needsAction.length === 0 ? <Empty text="No active inquiry tasks." /> : needsAction.map((inq) => {
            const contact = store.contacts.find((c) => c.id === inq.contactId);
            return <RecordRow key={inq.id} title={personName(contact)} meta={`${titleCase(inq.type)} · ${titleCase(inq.status)}`} action="Open" onClick={() => { setSelectedInquiryId(inq.id); setActive('inquiries'); }} />;
          })}
        </Panel>
        <Panel title="Almost booked" subtitle="Accepted work that is not complete yet.">
          {almostBooked.length === 0 ? <Empty text="No booking drafts yet." /> : almostBooked.map((booking) => {
            const contact = store.contacts.find((c) => c.id === booking.contactId);
            return <RecordRow key={booking.id} title={booking.title} meta={`${personName(contact)} · ${titleCase(booking.status)}`} action="Open" onClick={() => { setSelectedBookingId(booking.id); setActive('bookings'); }} />;
          })}
        </Panel>
      </div>
      <Panel title="Recent activity">
        <ActivityList activity={store.activity.slice(0, 8)} />
      </Panel>
    </section>
  );
}

function Inquiries(props) {
  const { store, selectedInquiryId, setSelectedInquiryId } = props;
  const [query, setQuery] = useState('');
  const filtered = store.inquiries.filter((inq) => {
    const contact = store.contacts.find((c) => c.id === inq.contactId);
    const haystack = `${personName(contact)} ${contact?.email} ${inq.type} ${inq.status} ${inq.visionSummary}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const selected = store.inquiries.find((i) => i.id === selectedInquiryId) || filtered[0];

  return (
    <section className="splitPage">
      <div className="listPane">
        <div className="listHeader">
          <input placeholder="Search inquiries" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {filtered.map((inq) => {
          const contact = store.contacts.find((c) => c.id === inq.contactId);
          return (
            <button key={inq.id} className={selected?.id === inq.id ? 'listItem active' : 'listItem'} onClick={() => setSelectedInquiryId(inq.id)}>
              <strong>{personName(contact)}</strong>
              <span>{titleCase(inq.type)} · {titleCase(inq.status)}</span>
              <small>{inq.preferredDate || 'No date'} · {inq.location || 'No location'}</small>
            </button>
          );
        })}
      </div>
      <div className="detailPane">
        {selected ? <InquiryDetail {...props} inquiry={selected} /> : <Empty text="No inquiry selected." />}
      </div>
    </section>
  );
}

function InquiryDetail({ store, inquiry, updateInquiry, buildQuoteForInquiry, sendEmailLog }) {
  const contact = store.contacts.find((c) => c.id === inquiry.contactId);
  const quote = store.quotes.find((q) => q.inquiryId === inquiry.id);
  const communications = store.communications.filter((c) => c.inquiryId === inquiry.id || c.contactId === contact?.id);

  return (
    <div className="stack">
      <div className="heroCard">
        <div>
          <p className="eyebrow">Inquiry</p>
          <h3>{personName(contact)}</h3>
          <p>{inquiry.visionSummary || 'No vision summary yet.'}</p>
        </div>
        <StatusBadge value={inquiry.status} />
      </div>
      <div className="grid3">
        <Info label="Email" value={contact?.email} />
        <Info label="Phone" value={contact?.phone} />
        <Info label="Instagram" value={contact?.instagram} />
        <Info label="Type" value={titleCase(inquiry.type)} />
        <Info label="Preferred date" value={inquiry.preferredDate || 'Not provided'} />
        <Info label="Location" value={inquiry.location || 'Not provided'} />
      </div>
      <div className="twoCol">
        <Panel title="Original answers">
          {inquiry.answers?.length ? inquiry.answers.map((answer, index) => <Info key={index} label={answer.question} value={Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer} />) : <Empty text="No raw answers." />}
        </Panel>
        <Panel title="Admin controls">
          <div className="buttonGrid">
            <button onClick={() => updateInquiry(inquiry.id, { status: STAGES.REVIEWING })}>Mark Reviewing</button>
            <button onClick={() => updateInquiry(inquiry.id, { status: STAGES.RESPONDED })}>Mark Responded</button>
            <button onClick={() => updateInquiry(inquiry.id, { status: STAGES.QUOTE_NEEDED })}>Quote Needed</button>
            <button className="danger" onClick={() => updateInquiry(inquiry.id, { status: STAGES.LOST })}>Mark Lost</button>
          </div>
        </Panel>
      </div>
      <QuoteBuilder inquiry={inquiry} contact={contact} quote={quote} buildQuoteForInquiry={buildQuoteForInquiry} />
      <EmailComposer store={store} contact={contact} inquiry={inquiry} quote={quote} sendEmailLog={sendEmailLog} />
      <Panel title="Communication log">
        {communications.length ? communications.map((comm) => <div className="logItem" key={comm.id}><strong>{comm.subject}</strong><p>{comm.body}</p><small>{new Date(comm.createdAt).toLocaleString()}</small></div>) : <Empty text="No communication logged yet." />}
      </Panel>
    </div>
  );
}

function QuoteBuilder({ inquiry, contact, quote, buildQuoteForInquiry }) {
  const [title, setTitle] = useState(`${titleCase(inquiry.type)} Session Recommendation`);
  const [note, setNote] = useState('A clean recommendation based on the submitted vision.');
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([{ id: uid('item'), name: `${titleCase(inquiry.type)} Session`, description: 'Session coverage and edited gallery.', quantity: 1, unitPrice: inquiry.type === 'wedding' ? 950 : 650 }]);
  const totals = calculateQuoteTotal(items, discount);

  if (quote) {
    return (
      <Panel title="Quote" subtitle="The quote is the bridge between inquiry and booking.">
        <div className="quoteCard">
          <div>
            <h4>{quote.title}</h4>
            <p>{quote.items.map((i) => i.name).join(', ')}</p>
          </div>
          <div className="right"><StatusBadge value={quote.status} /><strong>{formatMoney(quote.total)}</strong></div>
        </div>
      </Panel>
    );
  }

  function updateItem(id, patch) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <Panel title="Build quote" subtitle="Simple by design. Do not build invoice/accounting software here yet.">
      <div className="formGrid">
        <label>Quote title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Discount<input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
      </div>
      {items.map((item) => (
        <div className="lineItem" key={item.id}>
          <input value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} />
          <input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} />
          <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })} />
        </div>
      ))}
      <button className="ghost" onClick={() => setItems([...items, { id: uid('item'), name: 'Add-on', description: 'Optional add-on.', quantity: 1, unitPrice: 150 }])}>Add line item</button>
      <label>Client-facing note<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="totalBar"><span>Total</span><strong>{formatMoney(totals.total)}</strong></div>
      <button className="primary" onClick={() => buildQuoteForInquiry(inquiry, contact, { title, note, items, discount })}>Create Quote Draft</button>
    </Panel>
  );
}

function Quotes({ store, selectedQuoteId, setSelectedQuoteId, sendQuote, acceptQuote }) {
  const selected = store.quotes.find((q) => q.id === selectedQuoteId) || store.quotes[0];
  return (
    <section className="splitPage">
      <div className="listPane">
        {store.quotes.length === 0 ? <Empty text="No quotes yet. Build one from an inquiry." /> : store.quotes.map((quote) => {
          const contact = store.contacts.find((c) => c.id === quote.contactId);
          return <button key={quote.id} className={selected?.id === quote.id ? 'listItem active' : 'listItem'} onClick={() => setSelectedQuoteId(quote.id)}><strong>{quote.title}</strong><span>{personName(contact)} · {titleCase(quote.status)}</span><small>{formatMoney(quote.total)}</small></button>;
        })}
      </div>
      <div className="detailPane">
        {selected ? <QuoteDetail quote={selected} store={store} sendQuote={sendQuote} acceptQuote={acceptQuote} /> : <Empty text="No quote selected." />}
      </div>
    </section>
  );
}

function QuoteDetail({ quote, store, sendQuote, acceptQuote }) {
  const contact = store.contacts.find((c) => c.id === quote.contactId);
  return <div className="stack"><div className="heroCard"><div><p className="eyebrow">Quote</p><h3>{quote.title}</h3><p>{personName(contact)}</p></div><StatusBadge value={quote.status} /></div><Panel title="Line items">{quote.items.map((item) => <div className="quoteLine" key={item.id}><div><strong>{item.name}</strong><p>{item.description}</p></div><span>{formatMoney(item.unitPrice)}</span></div>)}<div className="totalBar"><span>Total</span><strong>{formatMoney(quote.total)}</strong></div></Panel><div className="buttonGrid"><button onClick={() => sendQuote(quote.id)}>Mark Sent</button><button className="primary" onClick={() => acceptQuote(quote.id)}>Accept Quote + Create Booking Draft</button></div></div>;
}

function Bookings(props) {
  const { store, selectedBookingId, setSelectedBookingId } = props;
  const selected = store.bookings.find((b) => b.id === selectedBookingId) || store.bookings[0];
  return <section className="splitPage"><div className="listPane">{store.bookings.length === 0 ? <Empty text="No booking drafts yet. Accept a quote first." /> : store.bookings.map((booking) => { const contact = store.contacts.find((c) => c.id === booking.contactId); return <button key={booking.id} className={selected?.id === booking.id ? 'listItem active' : 'listItem'} onClick={() => setSelectedBookingId(booking.id)}><strong>{booking.title}</strong><span>{personName(contact)} · {titleCase(booking.status)}</span><small>{booking.createdAt.slice(0, 10)}</small></button>; })}</div><div className="detailPane">{selected ? <BookingDetail {...props} booking={selected} /> : <Empty text="No booking selected." />}</div></section>;
}

function BookingDetail({ store, booking, updateBookingAsset, refreshBookingStatus }) {
  const contact = store.contacts.find((c) => c.id === booking.contactId);
  const contract = store.contracts.find((c) => c.bookingId === booking.id);
  const invoice = store.invoices.find((i) => i.bookingId === booking.id);
  const appointment = store.appointments.find((a) => a.bookingId === booking.id);
  const computed = computeBookingState({ booking, contract, invoice, appointment });
  const checklist = [
    ['Quote accepted', true],
    ['Contract sent', contract?.status === CONTRACT_STATUSES.SENT || contract?.status === CONTRACT_STATUSES.SIGNED],
    ['Contract signed', contract?.status === CONTRACT_STATUSES.SIGNED],
    ['Invoice sent', invoice?.status === INVOICE_STATUSES.SENT || invoice?.status === INVOICE_STATUSES.PAID],
    ['Payment received', invoice?.status === INVOICE_STATUSES.PAID],
    ['Date/time confirmed', Boolean(appointment?.confirmed && appointment?.startAt)],
  ];
  return <div className="stack"><div className="heroCard"><div><p className="eyebrow">Booking draft</p><h3>{booking.title}</h3><p>{personName(contact)}</p></div><StatusBadge value={computed} /></div><Panel title="Booking checklist">{checklist.map(([label, done]) => <div className="checkRow" key={label}><span className={done ? 'check on' : 'check'}>{done ? '✓' : ''}</span><span>{label}</span></div>)}<button className="primary" onClick={() => refreshBookingStatus(booking.id)}>Refresh Computed Status</button></Panel><div className="threeCol"><AssetCard title="Contract" status={contract?.status} actions={<><button onClick={() => updateBookingAsset('contract', contract.id, { status: CONTRACT_STATUSES.SENT, sentAt: nowIso() })}>Mark Sent</button><button onClick={() => updateBookingAsset('contract', contract.id, { status: CONTRACT_STATUSES.SIGNED, signedAt: nowIso() })}>Mark Signed</button></>} /><AssetCard title="Invoice" status={invoice?.status} meta={formatMoney(invoice?.total)} actions={<><button onClick={() => updateBookingAsset('invoice', invoice.id, { status: INVOICE_STATUSES.SENT, sentAt: nowIso() })}>Mark Sent</button><button onClick={() => updateBookingAsset('invoice', invoice.id, { status: INVOICE_STATUSES.PAID, amountPaid: invoice.total, paidAt: nowIso() })}>Mark Paid</button></>} /><AssetCard title="Date" status={appointment?.confirmed ? 'confirmed' : 'pending'} meta={appointment?.startAt || 'No date'} actions={<AppointmentEditor appointment={appointment} updateBookingAsset={updateBookingAsset} />} /></div></div>;
}

function AppointmentEditor({ appointment, updateBookingAsset }) {
  const [startAt, setStartAt] = useState(appointment?.startAt || '');
  return <div className="miniForm"><input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /><button onClick={() => updateBookingAsset('appointment', appointment.id, { startAt, confirmed: true })}>Confirm Date</button></div>;
}

function Contacts({ store, selectedContactId, setSelectedContactId }) {
  const selected = store.contacts.find((c) => c.id === selectedContactId) || store.contacts[0];
  return <section className="splitPage"><div className="listPane">{store.contacts.map((contact) => <button key={contact.id} className={selected?.id === contact.id ? 'listItem active' : 'listItem'} onClick={() => setSelectedContactId(contact.id)}><strong>{personName(contact)}</strong><span>{contact.email}</span><small>{titleCase(contact.status)} · {contact.tags.join(', ') || 'No tags'}</small></button>)}</div><div className="detailPane">{selected && <ContactDetail store={store} contact={selected} />}</div></section>;
}

function ContactDetail({ store, contact }) {
  const inquiries = store.inquiries.filter((i) => i.contactId === contact.id);
  const communications = store.communications.filter((c) => c.contactId === contact.id);
  return <div className="stack"><div className="heroCard"><div><p className="eyebrow">Contact</p><h3>{personName(contact)}</h3><p>{contact.email} · {contact.phone}</p></div><StatusBadge value={contact.status} /></div><Panel title="Linked inquiries">{inquiries.map((inq) => <RecordRow key={inq.id} title={titleCase(inq.type)} meta={`${inq.preferredDate || 'No date'} · ${titleCase(inq.status)}`} />)}</Panel><Panel title="Communication history">{communications.length ? communications.map((comm) => <div className="logItem" key={comm.id}><strong>{comm.subject}</strong><p>{comm.body}</p></div>) : <Empty text="No communication logged." />}</Panel></div>;
}

function Templates({ store }) {
  return <section className="stack"><Panel title="Templates" subtitle="V1 supports reusable email bodies with merge fields.">{store.templates.map((tpl) => <div className="templateCard" key={tpl.id}><strong>{tpl.name}</strong><span>{tpl.subject}</span><pre>{tpl.body}</pre></div>)}</Panel></section>;
}

function DevTools({ createManualInquiry, resetWorkspace }) {
  const presets = [
    ['Returning Family Client', { type: 'family', first: 'Nathalie', last: 'Alonso', email: `test+nathalie${Date.now()}@eccreativestudios.com`, phone: '7862267943', instagram: '@natvlonso', date: '2026-07-13', location: 'Outdoors', budget: '$550-$650', vision: 'Returning client. Family milestone session with warm outdoor editorial feel.', source: 'website' }],
    ['High-Value Wedding', { type: 'wedding', first: 'Isabella', last: 'Morales', email: `test+wedding${Date.now()}@eccreativestudios.com`, phone: '3050002200', instagram: '@isabellam', date: '2026-11-21', location: 'Vizcaya', budget: '$950+', vision: 'Simple, elegant, timeless wedding coverage with editorial portraits.', source: 'instagram' }],
    ['Incomplete Inquiry', { type: 'maternity', first: 'Ari', last: 'Rivera', email: `test+incomplete${Date.now()}@eccreativestudios.com`, phone: '', instagram: '', date: '', location: '', budget: '', vision: 'Needs help deciding location and styling.', source: 'website' }],
  ];
  return <section className="stack"><Panel title="Mock inquiry page" subtitle="Creates test records that land in the real inbox flow."><div className="buttonGrid">{presets.map(([label, p]) => <button key={label} onClick={() => createManualInquiry({ source: p.source, form_type: p.type, client: { first_name: p.first, last_name: p.last, email: p.email, phone: p.phone, instagram: p.instagram }, event: { type: p.type, date: p.date, location: p.location, budget: p.budget }, visionSummary: p.vision, answers: [{ question: 'Mock scenario', answer: label }, { question: 'Vision', answer: p.vision }], metadata: { is_mock: true, rawSource: 'dev-tools' } })}>{label}</button>)}</div></Panel><ManualInquiryForm createManualInquiry={createManualInquiry} /><Panel title="Workspace reset"><p>This clears local prototype data and reloads seed records.</p><button className="danger" onClick={resetWorkspace}>Reset Local Data</button></Panel></section>;
}

function ManualInquiryForm({ createManualInquiry }) {
  const [form, setForm] = useState({ first: '', last: '', email: '', phone: '', instagram: '', type: 'family', date: '', location: '', budget: '', vision: '', source: 'manual' });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return <Panel title="Manual inquiry"><div className="formGrid"><label>First<input value={form.first} onChange={(e) => set('first', e.target.value)} /></label><label>Last<input value={form.last} onChange={(e) => set('last', e.target.value)} /></label><label>Email<input value={form.email} onChange={(e) => set('email', e.target.value)} /></label><label>Phone<input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label><label>Instagram<input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} /></label><label>Type<select value={form.type} onChange={(e) => set('type', e.target.value)}><option>family</option><option>maternity</option><option>wedding</option><option>event</option><option>branding</option><option>milestone</option></select></label><label>Date<input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></label><label>Location<input value={form.location} onChange={(e) => set('location', e.target.value)} /></label></div><label>Vision<textarea value={form.vision} onChange={(e) => set('vision', e.target.value)} /></label><button className="primary" onClick={() => createManualInquiry({ source: form.source, form_type: form.type, client: { first_name: form.first, last_name: form.last, email: form.email, phone: form.phone, instagram: form.instagram }, event: { type: form.type, date: form.date, location: form.location, budget: form.budget }, visionSummary: form.vision, answers: [{ question: 'Manual vision', answer: form.vision }], metadata: { is_mock: false, rawSource: 'manual-admin' } })}>Create Inquiry</button></Panel>;
}

function Settings() {
  return <section className="stack"><Panel title="Production wiring"><div className="settingsList"><Info label="Client intake target" value="POST /api/inquiries" /><Info label="Email provider" value="Resend/Postmark adapter, not random server mail" /><Info label="Database" value="Supabase schema included in /supabase/schema.sql" /><Info label="App boundary" value="Admin only. Portal and marketing stay separate." /></div></Panel></section>;
}

function EmailComposer({ store, contact, inquiry, quote, sendEmailLog }) {
  const [templateId, setTemplateId] = useState(store.templates[0]?.id || '');
  const template = store.templates.find((t) => t.id === templateId) || store.templates[0];
  const context = { contact, inquiry, quote: quote ? { ...quote, totalFormatted: formatMoney(quote.total), retainerFormatted: formatMoney(quote.retainerDue) } : {} };
  const [body, setBody] = useState('');
  useEffect(() => { if (template) setBody(mergeTemplate(template.body, context)); }, [templateId, inquiry.id, quote?.id]);
  if (!contact) return null;
  return <Panel title="Communication workstation" subtitle="V1 logs sent email. Production adapter sends through authenticated domain."><div className="formGrid"><label>Template<select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{store.templates.map((tpl) => <option value={tpl.id} key={tpl.id}>{tpl.name}</option>)}</select></label><label>Subject<input value={template?.subject || ''} readOnly /></label></div><textarea value={body} onChange={(e) => setBody(e.target.value)} /><button className="primary" onClick={() => sendEmailLog({ contact, inquiry, quote, templateId, subject: template?.subject || 'EC Creative Studios', body })}>Log Email Send</button></Panel>;
}

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function Panel({ title, subtitle, children }) { return <section className="panel"><div className="panelHeader"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>; }
function Info({ label, value }) { return <div className="info"><span>{label}</span><strong>{value || '—'}</strong></div>; }
function StatusBadge({ value }) { return <span className={`badge ${String(value || '').replace(/_/g, '-')}`}>{titleCase(value || 'pending')}</span>; }
function Empty({ text }) { return <div className="empty">{text}</div>; }
function RecordRow({ title, meta, action, onClick }) { return <div className="recordRow"><div><strong>{title}</strong><span>{meta}</span></div>{action && <button onClick={onClick}>{action}</button>}</div>; }
function ActivityList({ activity }) { return <div className="activityList">{activity.map((item) => <div className="activity" key={item.id}><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString()}</small></div>)}</div>; }
function AssetCard({ title, status, meta, actions }) { return <Panel title={title}><StatusBadge value={status} />{meta && <p className="assetMeta">{meta}</p>}<div className="buttonStack">{actions}</div></Panel>; }
