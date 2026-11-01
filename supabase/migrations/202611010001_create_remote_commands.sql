create table if not exists public.remote_commands (
  id uuid primary key default gen_random_uuid(),
  device_id text not null check (char_length(device_id) between 1 and 128),
  action text not null check (action in ('set_mode', 'set_manual_pump', 'run_test')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'executed', 'rejected')),
  requested_by uuid not null default auth.uid() references auth.users(id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  execution_result text
);

create index if not exists remote_commands_pending_idx
  on public.remote_commands (device_id, requested_at)
  where status = 'queued';

alter table public.remote_commands enable row level security;

revoke all on table public.remote_commands from anon;
revoke all on table public.remote_commands from authenticated;
grant select, insert on table public.remote_commands to authenticated;

create policy "operators read their own remote commands"
on public.remote_commands
for select
to authenticated
using (requested_by = auth.uid());

create policy "operators enqueue their own remote commands"
on public.remote_commands
for insert
to authenticated
with check (requested_by = auth.uid());
