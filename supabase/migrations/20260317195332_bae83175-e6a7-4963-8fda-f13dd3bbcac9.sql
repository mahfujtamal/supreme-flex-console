DO $$
DECLARE
  t RECORD;
  p RECORD;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'spatial_ref_sys'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t.tablename);
    END LOOP;

    EXECUTE format('CREATE POLICY "dev_full_select" ON public.%I FOR SELECT TO public USING (true)', t.tablename);
    EXECUTE format('CREATE POLICY "dev_full_insert" ON public.%I FOR INSERT TO public WITH CHECK (true)', t.tablename);
    EXECUTE format('CREATE POLICY "dev_full_update" ON public.%I FOR UPDATE TO public USING (true) WITH CHECK (true)', t.tablename);
    EXECUTE format('CREATE POLICY "dev_full_delete" ON public.%I FOR DELETE TO public USING (true)', t.tablename);
  END LOOP;
END $$;