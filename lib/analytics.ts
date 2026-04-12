import { supabase } from './supabase';

export async function logEvent(
  event_type: 'proximity' | 'map_view' | 'scan' | 'tap' | 'save' | 'ar_view_3s',
  billboard_id: string,
  campaign_id: string | null,
  coords?: { latitude: number; longitude: number }
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fire and forget
    supabase
      .from('analytics_events')
      .insert({
        event_type,
        billboard_id,
        campaign_id,
        user_id: session?.user?.id || null,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
      })
      .then(({ error }) => {
        if (error) {
          // Senior Optimization: Handle deleted data gracefully
          // 23503 is "Foreign Key Violation" (e.g. campaign was deleted on server but still in app cache)
          if (error.code === '23503') {
            console.log(`[Analytics] Skipping log for deleted item: ${campaign_id || billboard_id}`);
            return;
          }
          console.error('Error logging event:', error);
        }
      });
  } catch (err) {
    // Silent fail
  }
}
