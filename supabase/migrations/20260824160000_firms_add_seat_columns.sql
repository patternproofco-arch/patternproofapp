-- public.firms was always missing the seat-tracking columns that
-- secure_multiseat's enforce_firm_seat_limit() function and
-- firm-grants.functions.ts (setMyFirm, firmSeatUsage) already assume exist.
-- Add them with the same semantics already coded against: seats_included
-- defaults to the free allotment (FIRM_SEAT_MAX = 5 in application code),
-- seats_purchased defaults to 0 additional purchased seats.
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS seats_included integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS seats_purchased integer NOT NULL DEFAULT 0;
