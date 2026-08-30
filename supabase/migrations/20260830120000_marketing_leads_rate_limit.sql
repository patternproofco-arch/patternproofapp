-- Support IP-based throttling of the public, unauthenticated
-- marketing_leads insert so the readiness-kit form can't be scripted to
-- flood an arbitrary inbox or spam pattern-proof.tech's sending domain.
alter table public.marketing_leads
  add column if not exists ip_hash text null;

create index if not exists marketing_leads_ip_hash_created_at_idx
  on public.marketing_leads(ip_hash, created_at desc);
