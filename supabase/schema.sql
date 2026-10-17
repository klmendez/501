-- Ejecuta este archivo en SQL Editor del proyecto Supabase antes de activar la integración.
create table if not exists public.catalog_state (
  id integer primary key check (id = 1),
  payload jsonb not null default '{"products":[],"deletedReferences":[]}'::jsonb,
  revision bigint not null default 0
);

alter table public.catalog_state enable row level security;
revoke all on public.catalog_state from public;
revoke all on public.catalog_state from anon, authenticated;
grant select, update on public.catalog_state to service_role;

insert into public.catalog_state (id) values (1) on conflict (id) do nothing;

create or replace function public.catalog_save(expected_revision bigint, next_payload jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(next_payload->'products') is distinct from 'array'
     or jsonb_typeof(next_payload->'deletedReferences') is distinct from 'array' then
    raise exception 'Catálogo inválido';
  end if;

  update public.catalog_state
     set payload = next_payload, revision = revision + 1
   where id = 1 and revision = expected_revision;
  return found;
end;
$$;

revoke all on function public.catalog_save(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.catalog_save(bigint, jsonb) to service_role;
