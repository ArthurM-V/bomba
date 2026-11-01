-- O ESP32 escreve exclusivamente pela Edge Function (chave secreta do servidor).
-- O painel recebe apenas SELECT, e somente apos autenticacao no Supabase Auth.
revoke all on table public.telemetry from anon;
revoke insert, update, delete, truncate, references, trigger on table public.telemetry from authenticated;
grant select on table public.telemetry to authenticated;

drop policy if exists "authenticated users can read telemetry" on public.telemetry;
create policy "authenticated users can read telemetry"
on public.telemetry
for select
to authenticated
using (true);
