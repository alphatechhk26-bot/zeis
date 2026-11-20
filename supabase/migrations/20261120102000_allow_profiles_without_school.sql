ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_school_id_required_for_non_super_admin;
