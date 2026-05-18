import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getFromCache, saveToCache } from '@/lib/offlineSync';
import { normalizeBillboardCoordinates } from '@/lib/utils';

export const useNearbyBillboards = (latitude: number, longitude: number, radiusKm: number = 5) => {
  const [billboards, setBillboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const isInitialLoad = useRef(true);

  const refresh = () => setRefreshCount(prev => prev + 1);

  const normalizeBillboard = (bb: any) => {
    const { latitude, longitude } = normalizeBillboardCoordinates(bb);

    return {
      ...bb,
      latitude: latitude ?? bb.latitude ?? null,
      longitude: longitude ?? bb.longitude ?? null,
    };
  };

  // Phase 1: Initial Cache Load
  useEffect(() => {
    const loadCache = async () => {
      const cached = await getFromCache();
      if (cached && isInitialLoad.current) {
        setBillboards(cached.map(normalizeBillboard));
        setLoading(false);
      }
    };
    loadCache();
  }, []);

  // Phase 2: Supabase Fetch & Sync
  useEffect(() => {
    if (!latitude || !longitude) return;

    const fetchBillboards = async () => {
      if (isInitialLoad.current) setLoading(true);
      
      console.log(`[API-FETCH] Querying nearby billboards for Lat: ${latitude}, Lng: ${longitude}`);

      const { data, error } = await supabase.rpc('get_nearby_billboards', {
        user_lat: latitude,
        user_long: longitude,
        distance_meters: radiusKm * 1000 
      });

 if (!error && data) {
  console.log('[DEBUG-HOME] Raw data payload rows fetched from RPC:', data.length);
  
  const parsedBillboards = data.map((bb: any) => {
    // Ensure campaigns are parsed into a JavaScript array safely
    let parsedCampaigns = [];
    if (typeof bb.campaigns === 'string') {
      try { parsedCampaigns = JSON.parse(bb.campaigns); } catch (e) { parsedCampaigns = []; }
    } else if (Array.isArray(bb.campaigns)) {
      parsedCampaigns = bb.campaigns;
    }
    return normalizeBillboard({ ...bb, campaigns: parsedCampaigns });
  });

  // Filter to keep rows that have image targets or matching active items
  const billboardsWithCampaigns = parsedBillboards.filter((bb: any) => {
    return bb.image_target_url || (bb.campaigns && bb.campaigns.length > 0);
  });
  
  console.log('[DEBUG-HOME] Rows preserved for rendering loop:', billboardsWithCampaigns.length);
  
  setBillboards(billboardsWithCampaigns);
  await saveToCache(billboardsWithCampaigns);
  isInitialLoad.current = false;
}
    setLoading(false);
  };

    fetchBillboards();
  }, [latitude, longitude, radiusKm, refreshCount]);

  return { billboards, loading, refresh };
};
