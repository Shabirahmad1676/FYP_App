import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const GEOFENCING_TASK_NAME = 'BILLBOARD_PROXIMITY_TASK';
const LOCAL_COOLDOWN_KEY_PREFIX = 'geofence_cooldown_';

const getTimeContext = () => {
  const hour = new Date().getHours();
  if (hour >= 12 && hour <= 15) return '🍽️ Perfect for lunch!';
  if (hour >= 19 && hour <= 22) return '🌙 Perfect for dinner!';
  if (hour >= 7 && hour <= 10) return '☀️ Start your morning right!';
  return '✨ Exclusive deal just for you!';
};

// Define the background task for proximity alerts
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Geofence Task Error:', error);
    return;
  }

  if (data.eventType === Location.GeofencingEventType.Enter) {
    const { region } = data;
    const billboardId = region.identifier;

    // --- Senior Upgrade: Local Cooldown Check (Works for guest & online) ---
    try {
      const lastLocalAlert = await AsyncStorage.getItem(`${LOCAL_COOLDOWN_KEY_PREFIX}${billboardId}`);
      if (lastLocalAlert) {
        const lastTime = parseInt(lastLocalAlert, 10);
        if (Date.now() - lastTime < 5 * 60 * 1000) {
          console.log(`⏳ [Local] Cooldown active for ${billboardId}. Blocking spam.`);
          return;
        }
      }
    } catch (e) {
      console.warn('AsyncStorage check failed in background task', e);
    }

    // Fetch campaign details for notification
    const { data: billboard, error: sbError } = await supabase
      .from('billboards')
      .select('*, campaigns(*)')
      .eq('id', billboardId)
      .single();

    if (!sbError && billboard) {
      const activeCampaign = billboard.campaigns?.find((c: any) => c.is_active);
      if (!activeCampaign) return;

      // 1. Double Check DB Cooldown if logged in (extra safety)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: existingSave } = await supabase
          .from('saved_offers')
          .select('last_alert_at')
          .eq('user_id', session.user.id)
          .eq('campaign_id', activeCampaign.id)
          .maybeSingle();

        if (existingSave?.last_alert_at) {
          const lastAlert = new Date(existingSave.last_alert_at).getTime();
          if (Date.now() - lastAlert < 5 * 60 * 1000) {
            console.log(`⏳ [DB] Cooldown active for ${activeCampaign.title}. Skipping.`);
            return;
          }
        }
      }

      // 2. Clear to Notify
      const timeContext = getTimeContext();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 ${activeCampaign.business_name} Nearby!`,
          body: `Check out: ${activeCampaign.title}. ${timeContext}`,
          data: { billboardId, campaignId: activeCampaign.id },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null,
      });

      // 3. Update BOTH cooldowns
      try {
        await AsyncStorage.setItem(`${LOCAL_COOLDOWN_KEY_PREFIX}${billboardId}`, Date.now().toString());
      } catch (e) {}

      if (session) {
        try {
          await supabase.from('saved_offers').upsert({
            user_id: session.user.id,
            campaign_id: activeCampaign.id,
            last_alert_at: new Date().toISOString()
          }, { onConflict: 'user_id,campaign_id' });
        } catch (e) {}
      }
    }
  }
});
