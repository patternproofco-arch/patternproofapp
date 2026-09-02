-- Hard-cap firm multi-seat membership at 5.
-- Existing firms are normalized so seats_included + seats_purchased never implies > 5.

UPDATE public.firms
SET
  seats_included = LEAST(COALESCE(seats_included, 5), 5),
  seats_purchased = GREATEST(
    0,
    LEAST(
      COALESCE(seats_purchased, 0),
      GREATEST(0, 5 - LEAST(COALESCE(seats_included, 5), 5))
    )
  )
WHERE COALESCE(seats_included, 0) + COALESCE(seats_purchased, 0) > 5
   OR seats_included IS NULL;

-- New default for any insert that omits seats_included.
ALTER TABLE public.firms
  ALTER COLUMN seats_included SET DEFAULT 5;

CREATE OR REPLACE FUNCTION public.enforce_firm_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT least(
           5,
           greatest(1, coalesce(seats_included, 5) + coalesce(seats_purchased, 0))
         )
  INTO v_limit
  FROM public.firms
  WHERE id = NEW.firm_id
  FOR UPDATE;
  IF v_limit IS NULL THEN RAISE EXCEPTION 'Firm not found'; END IF;
  SELECT count(*) INTO v_count FROM public.firm_members WHERE firm_id = NEW.firm_id;
  IF v_count >= v_limit THEN RAISE EXCEPTION 'This firm has reached its seat limit'; END IF;
  RETURN NEW;
END;
$$;
