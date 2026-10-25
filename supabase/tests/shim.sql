-- Imita o mínimo do Supabase (auth.users, auth.uid(), papéis e realtime)
-- para rodar as migrações e os testes num Postgres comum.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;
create publication supabase_realtime;
