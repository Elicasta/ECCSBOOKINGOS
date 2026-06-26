-- EC Booking OS v1 schema
-- Run in a fresh Supabase project. Enable RLS after policies are reviewed.

create extension if not exists "pgcrypto";

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text default '',
  email text not null unique,
  phone text default '',
  instagram text default '',
  status text not null default 'lead' check (status in ('lead','active_client','past_client','archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  type text not null,
  status text not null default 'new_inquiry',
  source text default 'website',
  preferred_date date,
  location text default '',
  budget_range text default '',
  guest_count text default '',
  vision_summary text default '',
  utm jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inquiry_answers (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries(id) on delete cascade,
  question text not null,
  answer jsonb not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  retainer_due numeric(12,2) not null default 0,
  note text default '',
  expires_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  name text not null,
  description text default '',
  quantity numeric(8,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  sort_order int not null default 0
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete cascade,
  title text not null,
  status text not null default 'booking_draft',
  checklist jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  external_url text default '',
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  invoice_number text not null unique,
  status text not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  retainer_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_url text default '',
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  start_at timestamptz,
  end_at timestamptz,
  location text default '',
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  inquiry_id uuid references inquiries(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  type text not null check (type in ('email','text','call','note')),
  direction text not null check (direction in ('inbound','outbound','internal')),
  subject text default '',
  body text not null,
  provider_message_id text,
  status text default 'logged',
  created_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'email',
  subject text default '',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inquiries_contact on inquiries(contact_id);
create index if not exists idx_inquiries_status on inquiries(status);
create index if not exists idx_quotes_inquiry on quotes(inquiry_id);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_communications_contact on communications(contact_id);
