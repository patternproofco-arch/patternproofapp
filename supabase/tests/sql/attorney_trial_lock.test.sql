-- Behavioural test for 20261011210000_lock_attorney_trial_fields.sql.
-- Run by scripts/run-attorney-trial-lock-sql-test.mjs (PGlite, synthetic data only).
-- Fixture: attorney A (11..) owns a row with no trial; attorney B (22..) has none yet;
-- D (44..) has an unconfirmed account email. Advocate profile for A exists.
DO $t$
DECLARE a constant uuid := '11111111-1111-4111-8111-111111111111';
        b constant uuid := '22222222-2222-4222-8222-222222222222';
        r record; denied boolean;
BEGIN
  -- ---------- as attorney A (user JWT) ----------
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;

  -- allowed profile edits
  UPDATE public.attorney_profiles
     SET full_name='A Edited', firm_name='Fictional Firm', bar_number='TEST-1', jurisdiction='Testland',
         updated_at=now()
   WHERE user_id=a;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: allowed profile edit matched no row'; END IF;

  -- each frozen field is rejected
  FOR r IN SELECT * FROM (VALUES
      ('email',           $$UPDATE public.attorney_profiles SET email = 'spoofed@example.invalid' WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('trial_ends_at',   $$UPDATE public.attorney_profiles SET trial_ends_at = now() + interval '10 years' WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('trial_started_at',$$UPDATE public.attorney_profiles SET trial_started_at = now() WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('trial_comped',    $$UPDATE public.attorney_profiles SET trial_comped = true WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('onboarded',       $$UPDATE public.attorney_profiles SET onboarded = true WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('role',            $$UPDATE public.attorney_profiles SET role = 'firm' WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('confidentiality', $$UPDATE public.attorney_profiles SET confidentiality_accepted_at = now() WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('created_at',      $$UPDATE public.attorney_profiles SET created_at = now() - interval '1 year' WHERE user_id = '11111111-1111-4111-8111-111111111111'$$),
      ('mixed',           $$UPDATE public.attorney_profiles SET full_name = 'sneaky', trial_ends_at = now() + interval '1 day' WHERE user_id = '11111111-1111-4111-8111-111111111111'$$)
    ) AS v(label, stmt)
  LOOP
    denied := false;
    BEGIN
      EXECUTE r.stmt;
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL: user could change %', r.label; END IF;
  END LOOP;

  -- ---------- as attorney B: insert own row with a future trial ----------
  PERFORM set_config('request.jwt.claim.sub', b::text, true);
  INSERT INTO public.attorney_profiles(user_id, full_name, email, trial_started_at, trial_ends_at, trial_comped, onboarded, role, confidentiality_accepted_at)
  VALUES (b, 'B', 'spoofed@example.invalid', now(), now() + interval '10 years', true, true, 'firm', now());

  -- ---------- as D (unconfirmed account email): insert is refused ----------
  PERFORM set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
  denied := false;
  BEGIN
    INSERT INTO public.attorney_profiles(user_id, full_name, email)
    VALUES ('44444444-4444-4444-8444-444444444444', 'D', 'd-typed@example.invalid');
  EXCEPTION WHEN not_null_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: unconfirmed account inserted a profile with a typed email'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  SELECT * INTO r FROM public.attorney_profiles WHERE user_id = b;
  IF r.trial_ends_at IS NOT NULL OR r.trial_started_at IS NOT NULL OR r.trial_comped OR r.onboarded
     OR r.role IS NOT NULL OR r.confidentiality_accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: user insert kept trial/onboarding fields: %', row_to_json(r);
  END IF;
  IF r.full_name <> 'B' THEN RAISE EXCEPTION 'FAIL: user insert lost profile fields'; END IF;
  IF r.email <> 'b@patternproof.test' THEN
    RAISE EXCEPTION 'FAIL: user insert kept a typed email instead of the confirmed auth email: %', r.email;
  END IF;

  SELECT * INTO r FROM public.attorney_profiles WHERE user_id = a;
  IF r.full_name <> 'A Edited' OR r.email <> 'a@patternproof.test' OR r.trial_ends_at IS NOT NULL OR r.trial_comped OR r.onboarded THEN
    RAISE EXCEPTION 'FAIL: attorney A row wrong after user edits: %', row_to_json(r);
  END IF;

  -- ---------- server role (no JWT) may assign trials ----------
  SET LOCAL ROLE service_role;
  UPDATE public.attorney_profiles
     SET trial_started_at = now(), trial_ends_at = now() + interval '90 days', trial_comped = true, onboarded = true
   WHERE user_id = a;
  INSERT INTO public.attorney_profiles(user_id, full_name, email, trial_ends_at, trial_comped)
  VALUES ('33333333-3333-4333-8333-333333333333', 'C', 'c@patternproof.test', now() + interval '90 days', true);
  RESET ROLE;
  SELECT * INTO r FROM public.attorney_profiles WHERE user_id = a;
  IF r.trial_ends_at IS NULL OR NOT r.trial_comped OR NOT r.onboarded THEN
    RAISE EXCEPTION 'FAIL: service role could not assign the trial';
  END IF;
  IF NOT (SELECT trial_comped FROM public.attorney_profiles WHERE user_id = '33333333-3333-4333-8333-333333333333') THEN
    RAISE EXCEPTION 'FAIL: service role insert lost trial fields';
  END IF;

  -- ---------- after the server grants a trial, the user still cannot extend it ----------
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  denied := false;
  BEGIN
    UPDATE public.attorney_profiles SET trial_ends_at = trial_ends_at + interval '5 years' WHERE user_id = a;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: user extended a server-granted trial'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- ---------- profile emails follow the CONFIRMED auth email ----------
  -- An unconfirmed change (no email_confirmed_at) does not sync.
  UPDATE auth.users SET email = 'pending@patternproof.test', email_confirmed_at = NULL WHERE id = a;
  IF (SELECT email FROM public.attorney_profiles WHERE user_id = a) <> 'a@patternproof.test' THEN
    RAISE EXCEPTION 'FAIL: unconfirmed auth email synced into attorney profile';
  END IF;
  -- Confirmation syncs both attorney and advocate copies (lower-cased).
  UPDATE auth.users SET email = 'A-New@PatternProof.test', email_confirmed_at = now() WHERE id = a;
  IF (SELECT email FROM public.attorney_profiles WHERE user_id = a) <> 'a-new@patternproof.test' THEN
    RAISE EXCEPTION 'FAIL: confirmed auth email not synced into attorney profile';
  END IF;
  IF (SELECT email FROM public.advocate_profiles WHERE user_id = a) <> 'a-new@patternproof.test' THEN
    RAISE EXCEPTION 'FAIL: confirmed auth email not synced into advocate profile';
  END IF;

  RAISE NOTICE 'PASS: attorney trial and email fields are locked for users; profile edits, server role and auth email sync work';
END
$t$;
