create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(btrim(email)) between 3 and 255),
  phone text null check (phone is null or char_length(btrim(phone)) <= 40),
  persona text not null check (persona in ('attorney', 'org')),
  source_page text not null check (source_page in ('/for-attorneys', '/for-organizations')),
  created_at timestamptz not null default now()
);

alter table public.marketing_leads enable row level security;

revoke all on public.marketing_leads from anon, authenticated;
grant insert on public.marketing_leads to anon, authenticated;
grant all on public.marketing_leads to service_role;

create policy "public may submit professional kit requests"
  on public.marketing_leads
  for insert
  to anon, authenticated
  with check (
    persona in ('attorney', 'org')
    and source_page in ('/for-attorneys', '/for-organizations')
  );

create index if not exists marketing_leads_created_at_idx
  on public.marketing_leads(created_at desc);
create index if not exists marketing_leads_persona_email_idx
  on public.marketing_leads(persona, lower(email));
