import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getFromCache, saveToCache } from '@/lib/offlineSync';

export const useNearbyBillboards = (latitude: number, longitude: number, radiusKm: number = 5) => {
  const [billboards, setBillboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const isInitialLoad = useRef(true);

  const refresh = () => setRefreshCount(prev => prev + 1);

  // Phase 1: Initial Cache Load
  useEffect(() => {
    const loadCache = async () => {
      const cached = await getFromCache();
      if (cached && isInitialLoad.current) {
        setBillboards(cached);
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
      
      const { data, error } = await supabase.rpc('get_nearby_billboards', {
        user_lat: latitude,
        user_long: longitude,
        distance_meters: radiusKm * 1000 
      });

      if (!error && data) {
        const billboardsWithCampaigns = data.filter((bb: any) => 
          bb.campaigns && bb.campaigns.some((c: any) => c.is_active)
        );
        
        setBillboards(billboardsWithCampaigns);
        // Save to cache for offline availability
        await saveToCache(billboardsWithCampaigns);
        isInitialLoad.current = false;
      } else if (error) {
        console.error('RPC Error (falling back to cache):', error);
      }
      setLoading(false);
    };

    fetchBillboards();
  }, [latitude, longitude, radiusKm, refreshCount]);

  return { billboards, loading, refresh };
};
