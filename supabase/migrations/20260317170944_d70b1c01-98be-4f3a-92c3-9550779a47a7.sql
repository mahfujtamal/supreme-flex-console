
-- Create updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Table 1: network_zones
CREATE TABLE public.network_zones (
  network_zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_zone_name TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.network_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read network_zones" ON public.network_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert network_zones" ON public.network_zones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update network_zones" ON public.network_zones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete network_zones" ON public.network_zones FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_network_zones_updated_at BEFORE UPDATE ON public.network_zones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: districts
CREATE TABLE public.districts (
  district_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_name TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read districts" ON public.districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert districts" ON public.districts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update districts" ON public.districts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete districts" ON public.districts FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON public.districts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 3: areas
CREATE TABLE public.areas (
  area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_name TEXT NOT NULL,
  district_id UUID NOT NULL REFERENCES public.districts(district_id) ON DELETE CASCADE,
  network_zone_id UUID NOT NULL REFERENCES public.network_zones(network_zone_id) ON DELETE CASCADE,
  is_4g_area BOOLEAN NOT NULL DEFAULT false,
  is_5g_area BOOLEAN NOT NULL DEFAULT false,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read areas" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert areas" ON public.areas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update areas" ON public.areas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete areas" ON public.areas FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON public.areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 4: channels
CREATE TABLE public.channels (
  channel_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read channels" ON public.channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update channels" ON public.channels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete channels" ON public.channels FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 5: sub_channels
CREATE TABLE public.sub_channels (
  sub_channel_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_channel_name TEXT NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.channels(channel_id) ON DELETE CASCADE,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sub_channels" ON public.sub_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sub_channels" ON public.sub_channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sub_channels" ON public.sub_channels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete sub_channels" ON public.sub_channels FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_sub_channels_updated_at BEFORE UPDATE ON public.sub_channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
