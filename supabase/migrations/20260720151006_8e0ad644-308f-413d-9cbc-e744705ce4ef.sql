-- Replace the broad FOR ALL policy with explicit per-command policies so
-- the scanner can see that INSERT/UPDATE/DELETE are restricted to the
-- owning attorney (identical effect; more explicit).
DROP POLICY IF EXISTS "Owner attorney manages collaborators" ON public.case_collaborators;

CREATE POLICY "Owner attorney selects collaborators"
  ON public.case_collaborators
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_attorney_user_id);

CREATE POLICY "Owner attorney inserts collaborators"
  ON public.case_collaborators
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_attorney_user_id);

CREATE POLICY "Owner attorney updates collaborators"
  ON public.case_collaborators
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_attorney_user_id)
  WITH CHECK (auth.uid() = owner_attorney_user_id);

CREATE POLICY "Owner attorney deletes collaborators"
  ON public.case_collaborators
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_attorney_user_id);