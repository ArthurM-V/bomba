-- Uma telemetria e identificada pelo ciclo de inicializacao do ESP32 e pela
-- sequencia monotona daquele ciclo. Reenvios apos timeout tornam-se idempotentes.
alter table public.telemetry
  add column if not exists boot_id text,
  add column if not exists event_sequence bigint;

alter table public.telemetry
  add constraint telemetry_boot_id_length_check
    check (char_length(boot_id) between 1 and 64),
  add constraint telemetry_event_sequence_check
    check (event_sequence >= 0);

alter table public.telemetry
  alter column boot_id set not null,
  alter column event_sequence set not null;

create unique index if not exists telemetry_device_boot_sequence_idx
  on public.telemetry (device_id, boot_id, event_sequence);

-- O firmware envia normalmente uma leitura a cada cinco segundos. Um limite de
-- uma insercao por segundo impede rajadas sem impedir a recuperacao normal.
create or replace function public.enforce_telemetry_rate_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.device_id)::bigint);

  if exists (
    select 1
    from public.telemetry
    where device_id = new.device_id
      and boot_id = new.boot_id
      and event_sequence = new.event_sequence
  ) then
    return null;
  end if;

  if exists (
    select 1
    from public.telemetry
    where device_id = new.device_id
      and received_at > statement_timestamp() - interval '1 second'
  ) then
    raise exception 'TELEMETRY_RATE_LIMITED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_telemetry_rate_limit() from public, anon, authenticated;

drop trigger if exists telemetry_rate_limit on public.telemetry;
create trigger telemetry_rate_limit
before insert on public.telemetry
for each row execute function public.enforce_telemetry_rate_limit();
