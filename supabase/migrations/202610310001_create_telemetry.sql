create table if not exists public.telemetry (
  id uuid primary key default gen_random_uuid(),
  device_id text not null check (char_length(device_id) between 1 and 128),
  received_at timestamptz not null default now(),
  device_timestamp_ms bigint,
  virtual_hours numeric(12, 3) not null check (virtual_hours >= 0),
  lower_level numeric(5, 2) not null check (lower_level between 0 and 100),
  upper_level numeric(5, 2) not null check (upper_level between 0 and 100),
  operation_mode text not null check (operation_mode in ('auto', 'manual')),
  lead_pump smallint not null check (lead_pump in (1, 2)),
  commanded_pump smallint check (commanded_pump in (1, 2)),
  manual_pump smallint check (manual_pump in (1, 2)),
  alarms text not null default 'NONE',
  pumps jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null
);

create index if not exists telemetry_device_received_at_idx
  on public.telemetry (device_id, received_at desc);

alter table public.telemetry enable row level security;
