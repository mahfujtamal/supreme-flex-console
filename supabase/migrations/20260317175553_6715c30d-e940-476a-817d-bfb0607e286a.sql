
-- Drop existing policies and recreate with anon+authenticated access for campaign tables

-- campaign_master
DROP POLICY IF EXISTS "Authenticated read campaign_master" ON public.campaign_master;
DROP POLICY IF EXISTS "Authenticated insert campaign_master" ON public.campaign_master;
DROP POLICY IF EXISTS "Authenticated update campaign_master" ON public.campaign_master;
DROP POLICY IF EXISTS "Authenticated delete campaign_master" ON public.campaign_master;

CREATE POLICY "Allow all select campaign_master" ON public.campaign_master FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert campaign_master" ON public.campaign_master FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update campaign_master" ON public.campaign_master FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete campaign_master" ON public.campaign_master FOR DELETE TO anon, authenticated USING (true);

-- campaign_targeting_rules
DROP POLICY IF EXISTS "Authenticated read ctr" ON public.campaign_targeting_rules;
DROP POLICY IF EXISTS "Authenticated insert ctr" ON public.campaign_targeting_rules;
DROP POLICY IF EXISTS "Authenticated update ctr" ON public.campaign_targeting_rules;
DROP POLICY IF EXISTS "Authenticated delete ctr" ON public.campaign_targeting_rules;

CREATE POLICY "Allow all select ctr" ON public.campaign_targeting_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert ctr" ON public.campaign_targeting_rules FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update ctr" ON public.campaign_targeting_rules FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete ctr" ON public.campaign_targeting_rules FOR DELETE TO anon, authenticated USING (true);

-- campaign_product_rules
DROP POLICY IF EXISTS "Authenticated read cpr" ON public.campaign_product_rules;
DROP POLICY IF EXISTS "Authenticated insert cpr" ON public.campaign_product_rules;
DROP POLICY IF EXISTS "Authenticated update cpr" ON public.campaign_product_rules;
DROP POLICY IF EXISTS "Authenticated delete cpr" ON public.campaign_product_rules;

CREATE POLICY "Allow all select cpr" ON public.campaign_product_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert cpr" ON public.campaign_product_rules FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update cpr" ON public.campaign_product_rules FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete cpr" ON public.campaign_product_rules FOR DELETE TO anon, authenticated USING (true);
