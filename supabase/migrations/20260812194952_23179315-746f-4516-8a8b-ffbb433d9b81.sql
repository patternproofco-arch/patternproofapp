
create or replace function public.list_my_oauth_consents()
returns table (
  id uuid,
  client_id uuid,
  client_name text,
  client_uri text,
  scopes text,
  granted_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select c.id, c.client_id, cl.client_name, cl.client_uri, c.scopes, c.granted_at
  from auth.oauth_consents c
  join auth.oauth_clients cl on cl.id = c.client_id
  where c.user_id = auth.uid()
    and c.revoked_at is null
    and cl.deleted_at is null
  order by c.granted_at desc
$$;

revoke all on function public.list_my_oauth_consents() from public, anon;
grant execute on function public.list_my_oauth_consents() to authenticated;

create or replace function public.revoke_my_oauth_consent(_consent_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  _n int;
begin
  if auth.uid() is null then
    return false;
  end if;
  update auth.oauth_consents
     set revoked_at = now()
   where id = _consent_id
     and user_id = auth.uid()
     and revoked_at is null;
  get diagnostics _n = row_count;
  return _n > 0;
end;
$$;

revoke all on function public.revoke_my_oauth_consent(uuid) from public, anon;
grant execute on function public.revoke_my_oauth_consent(uuid) to authenticated;
