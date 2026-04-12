-- Phase 10 Security Hardening: Enable Database RLS
-- Run this in your Supabase SQL Editor to lock down your AR infrastructure.

-- 1. Enable RLS for Billboards
ALTER TABLE public.billboards ENABLE ROW LEVEL SECURITY;

-- 2. Define Policies for Billboards
-- Allow everyone to SEE billboards (required for Discovery view)
DROP POLICY IF EXISTS "Allow public read access" ON public.billboards;
CREATE POLICY "Allow public read access" ON public.billboards
    FOR SELECT TO public
    USING (true);

-- Allow only Authenticated Users to UPDATE billboards (hosting anchors)
DROP POLICY IF EXISTS "Allow authenticated update" ON public.billboards;
CREATE POLICY "Allow authenticated update" ON public.billboards
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Enable RLS for Analytics (to prevent spoofing)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow only Authenticated Users (or Public if guest) to INSERT events
DROP POLICY IF EXISTS "Allow public event logging" ON public.analytics_events;
CREATE POLICY "Allow public event logging" ON public.analytics_events
    FOR INSERT TO public
    WITH CHECK (true);

-- No one should be able to UPDATE or DELETE analytics events!
DROP POLICY IF EXISTS "Prevent analytics tampering" ON public.analytics_events;
CREATE POLICY "Prevent analytics tampering" ON public.analytics_events
    FOR UPDATE USING (false);
