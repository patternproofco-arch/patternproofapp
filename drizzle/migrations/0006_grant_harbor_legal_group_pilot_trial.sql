-- Pilot trial for the fictional practice firm "Harbor Legal Group" only.
-- Uses the existing, production-safe trial mechanism (attorney_profiles.trial_ends_at)
-- rather than any test-account bypass in application code.
UPDATE public.attorney_profiles p
SET trial_ends_at = '2027-09-30 00:00:00+00',
    updated_at = now()
WHERE p.firm_name = 'Harbor Legal Group'
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p.user_id
      AND u.email LIKE '%@patternproof.test'
  );