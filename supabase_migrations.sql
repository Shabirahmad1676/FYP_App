-- Phase 3 Migration: Add Cloud Anchor & 3D Asset Support
-- Run this in your Supabase SQL Editor

-- 1. Update the Billboards table
ALTER TABLE public.billboards 
ADD COLUMN IF NOT EXISTS cloud_anchor_id TEXT,
ADD COLUMN IF NOT EXISTS glb_asset_url TEXT;

-- 2. Update the Campaigns table (optional but recommended for campaign-specific 3D models)
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS glb_asset_url TEXT;

-- 3. Add friendly names for your columns if needed (optional)
COMMENT ON COLUMN public.billboards.cloud_anchor_id IS 'The ReactVision Cloud Anchor ID for 3D spatial mapping';
COMMENT ON COLUMN public.billboards.glb_asset_url IS 'The default 3D model (.glb) for this physical billboard';
COMMENT ON COLUMN public.campaigns.glb_asset_url IS 'Overriding 3D model (.glb) for this specific campaign';
