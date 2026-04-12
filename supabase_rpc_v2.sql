-- Phase 7 Migration: Update atomic billboard publishing RPC
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.publish_billboard_with_campaign(
    p_billboard_id      UUID DEFAULT NULL,
    p_owner_id          UUID DEFAULT auth.uid(),
    p_latitude          DOUBLE PRECISION DEFAULT NULL,
    p_longitude         DOUBLE PRECISION DEFAULT NULL,
    p_address           TEXT DEFAULT NULL,
    p_city              TEXT DEFAULT NULL,
    p_category          TEXT DEFAULT NULL,
    p_image_target_url  TEXT DEFAULT NULL,
    p_physical_width    DOUBLE PRECISION DEFAULT 1.0,
    -- NEW FIELDS FOR CLOUD ANCHORS & GLB assets
    p_cloud_anchor_id   TEXT DEFAULT NULL,
    p_glb_asset_url     TEXT DEFAULT NULL,
    -- CAMPAIGN FIELDS
    p_business_name     TEXT DEFAULT NULL,
    p_title             TEXT DEFAULT NULL,
    p_description       TEXT DEFAULT NULL,
    p_media_url         TEXT DEFAULT NULL,
    p_discount          TEXT DEFAULT NULL,
    p_features          TEXT[] DEFAULT '{}',
    p_hours             TEXT DEFAULT NULL,
    p_contact           TEXT DEFAULT NULL
) 
RETURNS UUID AS $$
DECLARE
    v_billboard_id UUID;
BEGIN
    -- 1. Create or Update Billboard
    IF p_billboard_id IS NOT NULL THEN
        UPDATE public.billboards SET
            latitude = COALESCE(p_latitude, latitude),
            longitude = COALESCE(p_longitude, longitude),
            address = COALESCE(p_address, address),
            city = COALESCE(p_city, city),
            category = COALESCE(p_category, category),
            image_target_url = COALESCE(p_image_target_url, image_target_url),
            physical_width = COALESCE(p_physical_width, physical_width),
            cloud_anchor_id = COALESCE(p_cloud_anchor_id, cloud_anchor_id),
            glb_asset_url = COALESCE(p_glb_asset_url, glb_asset_url),
            updated_at = NOW()
        WHERE id = p_billboard_id
        RETURNING id INTO v_billboard_id;
    ELSE
        INSERT INTO public.billboards (
            owner_id, latitude, longitude, address, city, category, 
            image_target_url, physical_width, cloud_anchor_id, glb_asset_url
        ) VALUES (
            p_owner_id, p_latitude, p_longitude, p_address, p_city, p_category, 
            p_image_target_url, p_physical_width, p_cloud_anchor_id, p_glb_asset_url
        )
        RETURNING id INTO v_billboard_id;
    END IF;

    -- 2. Handle Campaign (Upsert active campaign for this billboard)
    -- This assumes 1 active campaign per billboard for now
    INSERT INTO public.campaigns (
        billboard_id, business_name, title, description, media_url, 
        discount, features, hours, contact, glb_asset_url, is_active
    ) 
    VALUES (
        v_billboard_id, p_business_name, p_title, p_description, p_media_url, 
        p_discount, p_features, p_hours, p_contact, p_glb_asset_url, true
    )
    ON CONFLICT (billboard_id) WHERE is_active = true 
    DO UPDATE SET
        business_name = COALESCE(p_business_name, campaigns.business_name),
        title = COALESCE(p_title, campaigns.title),
        description = COALESCE(p_description, campaigns.description),
        media_url = COALESCE(p_media_url, campaigns.media_url),
        discount = COALESCE(p_discount, campaigns.discount),
        features = COALESCE(p_features, campaigns.features),
        hours = COALESCE(p_hours, campaigns.hours),
        contact = COALESCE(p_contact, campaigns.contact),
        glb_asset_url = COALESCE(p_glb_asset_url, campaigns.glb_asset_url),
        updated_at = NOW();

    RETURN v_billboard_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
