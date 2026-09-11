# Supabase security work: constrained verification and safe changes

## Locked constraints

- Keep the eight identified no-policy tables service-role-only.
- Do not add generic `user_id` policies to those tables.
- Do not revoke either RPC until its complete usage path is confirmed.
- Do not drop, replace, or modify any index.
- Pause before any destructive database operation and report the exact proposed statement, impact, and rollback path.

## Next safe step: read-only RPC usage audit

1. Trace both RPC names across screens, client hooks, server functions, API routes, tests, generated database types, and migrations.
2. Inspect database-side dependencies, grants, and policy/function references that may call them indirectly.
3. Classify each RPC as actively used, indirectly required, or unreferenced.
4. Report the evidence before proposing any permission change. An absent direct screen call alone will not justify revocation.

## Service-role-only table verification

- Verify the eight tables have RLS enabled and no browser-facing policies.
- Verify `anon` and `authenticated` cannot perform table operations, while service-role access remains available only to trusted server paths.
- Treat a no-policy linter notice as intentional for these tables; do not “fix” it by adding broad policies.
- If any table still has browser-role grants, propose a least-privilege grant correction separately without changing its service-role-only design.

## Non-destructive validation

- Re-run the database linter and security scan.
- Compare live grants, policies, function privileges, and dependencies with the intended model.
- Run affected authorization tests and application checks if a later migration is approved.

## Change gate

No database migration will be applied from this plan until the read-only audit identifies a necessary change. Before any destructive or access-reducing statement, present:

- the exact object and SQL operation;
- confirmed application and database dependencies;
- expected user-facing impact;
- rollback SQL;
- the validation steps that will prove the change safe.
