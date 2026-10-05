-- Court-Prep Coach & Survivor Intake (spec v5 hardened).
-- Minimal persistence only. Never stores practice answers, county/court branch,
-- children's names/DOBs, docket numbers, judge names, or confidential addresses.
-- Grace: apply on muy only (muynotmkcmehxnkhffzl). Do not apply from CI/agent.
-- Safe if optional extensions (pgcrypto) are already present; uses gen_random_uuid
-- which is provided by pgcrypto OR by Postgres 13+ built-in.

CREATE TABLE IF NOT EXISTS public.study_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state text,
  hearing_types text[] NOT NULL DEFAULT '{}'::text[],
  hearing_date date,
  order_status text,
  learning_mode text NOT NULL DEFAULT 'both',
  children_brackets text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_profiles_order_status_check
    CHECK (order_status IS NULL OR order_status IN ('none', 'temporary_order', 'decree_in_place')),
  CONSTRAINT study_profiles_learning_mode_check
    CHECK (learning_mode IN ('coach', 'guide', 'both')),
  CONSTRAINT study_profiles_hearing_types_check
    CHECK (
      hearing_types <@ ARRAY[
        'protective_order',
        'custody',
        'divorce',
        'support',
        'other_family'
      ]::text[]
    ),
  CONSTRAINT study_profiles_children_brackets_check
    CHECK (
      children_brackets <@ ARRAY['under_5', '5_to_11', '12_plus']::text[]
    ),
  CONSTRAINT study_profiles_state_check
    CHECK (state IS NULL OR char_length(state) BETWEEN 2 AND 2)
);

COMMENT ON TABLE public.study_profiles IS
  'Minimal court-prep intake. Excludes location branch, street address, docket, judge, and child identity fields.';

COMMENT ON COLUMN public.study_profiles.children_brackets IS
  'Developmental age brackets only. Never store names or birthdates.';

CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_lesson_progress_status_check
    CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT user_lesson_progress_user_module_unique UNIQUE (user_id, module_id)
);

COMMENT ON TABLE public.user_lesson_progress IS
  'Binary module progress only. Never store practice answers or coach transcript text.';

ALTER TABLE public.study_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_profiles_owner_select" ON public.study_profiles;
DROP POLICY IF EXISTS "study_profiles_owner_insert" ON public.study_profiles;
DROP POLICY IF EXISTS "study_profiles_owner_update" ON public.study_profiles;
DROP POLICY IF EXISTS "study_profiles_owner_delete" ON public.study_profiles;

CREATE POLICY "study_profiles_owner_select" ON public.study_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "study_profiles_owner_insert" ON public.study_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_profiles_owner_update" ON public.study_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_profiles_owner_delete" ON public.study_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_lesson_progress_owner_select" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "user_lesson_progress_owner_insert" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "user_lesson_progress_owner_update" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "user_lesson_progress_owner_delete" ON public.user_lesson_progress;

CREATE POLICY "user_lesson_progress_owner_select" ON public.user_lesson_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_lesson_progress_owner_insert" ON public.user_lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_lesson_progress_owner_update" ON public.user_lesson_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_lesson_progress_owner_delete" ON public.user_lesson_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.study_profiles FROM anon;
REVOKE ALL ON public.user_lesson_progress FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lesson_progress TO authenticated;

-- Defense in depth: block legacy columns if somehow added later via drift.
-- Explicitly document forbidden columns (not created).
-- Forbidden: county, court_name, court_branch, address, acp_status,
-- case_number, docket_number, judge_name, department_name,
-- child_name, child_dob, practice_answer, practice_text, coach_transcript.
