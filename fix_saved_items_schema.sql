-- Migration: Fix saved_items/saved_offers schema
-- This script fixes the missing columns and RLS policy for saving coupons and billboards

-- 1. Create a generic saved_items table (or use saved_offers with new columns)
CREATE TABLE IF NOT EXISTS public.saved_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('coupon', 'billboard')),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    billboard_id UUID REFERENCES public.billboards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, type, campaign_id, billboard_id)
);

-- 2. Enable RLS on saved_items
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

-- 2.1 Grant table access to authenticated users.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_items TO authenticated;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own saved items" ON public.saved_items;
DROP POLICY IF EXISTS "Users can insert their own saved items" ON public.saved_items;
DROP POLICY IF EXISTS "Users can delete their own saved items" ON public.saved_items;
DROP POLICY IF EXISTS "Users can update their own saved items" ON public.saved_items;

-- 4. Create comprehensive RLS policies for saved_items
CREATE POLICY "Users can view their own saved items" ON public.saved_items
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved items" ON public.saved_items
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved items" ON public.saved_items
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved items" ON public.saved_items
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON public.saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_campaign_id ON public.saved_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_billboard_id ON public.saved_items(billboard_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_type ON public.saved_items(type);
