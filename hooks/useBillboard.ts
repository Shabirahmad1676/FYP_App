import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Billboard {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  image_target_url?: string;
  physical_width?: number;
}

export interface Campaign {
  id: string;
  billboard_id: string;
  business_name: string;
  title: string;
  description?: string;
  website_url?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  contact?: string;
  is_active: boolean;
}

export const useBillboard = (id: string | null) => {
  const [billboard, setBillboard] = useState<Billboard | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchBillboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: sbError } = await supabase
          .from('billboards')
          .select('*, campaigns(*)')
          .eq('id', id)
          .single();

        if (sbError) throw sbError;

        if (data) {
          const { campaigns, ...bbData } = data;
          setBillboard(bbData);
          
          // Get the first active campaign
          const activeCampaign = campaigns?.find((c: any) => c.is_active);
          setCampaign(activeCampaign || null);
        }
      } catch (err: any) {
        console.error('Error fetching billboard:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBillboard();
  }, [id]);

  return { billboard, campaign, loading, error };
};
