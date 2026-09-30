-- Practice (fictional, sandbox) attorney account only: its seeded subscription lapsed on 2026-08-21.
UPDATE public.subscriptions
SET current_period_end = '2027-09-30 00:00:00+00', updated_at = now()
WHERE user_id = 'd074c8fb-9549-402a-928e-7ad7095a0885'
  AND stripe_subscription_id = 'seed_sub_aa'
  AND environment = 'sandbox';