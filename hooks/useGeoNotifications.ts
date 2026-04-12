import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase';
import { GEOFENCING_TASK_NAME } from '@/lib/geofencing';
import { registerForPushNotificationsAsync } from '@/lib/notifications';

const PROXIMITY_RADIUS = 500; // 500m as requested for launch

export const useGeoNotifications = () => {
  
  /**
   * Main Setup: Requests permissions and registers the top 100 nearby geofences.
   */
  const setupGeofencing = async () => {
    try {
      // 1. Permissions (Foreground + Background)
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        // Essential for background proximity alerts
        console.warn('Background location permission denied');
        return;
      }

      // 2. Notification Permissions (Non-blocking)
      try {
        await registerForPushNotificationsAsync();
      } catch (e) {
        console.warn('Notification setup skipped:', e);
      }

      // 3. Data Fetching (Active Only)
      // Optimized for "Millimeter-accurate discovery"
      const { data: billboards, error } = await supabase
        .from('billboards')
        .select(`
          id, 
          latitude, 
          longitude,
          owner_id,
          campaigns!inner(is_active)
        `)
        .eq('campaigns.is_active', true)
        .not('owner_id', 'is', null) // Only monitor "Real" merchant ads
        .limit(100); // Android 100-geofence hard limit

      if (error) {
        console.error('Failed to fetch billboards for geofencing:', error);
        return;
      }

      if (billboards && billboards.length > 0) {
        const regions = billboards.map(bb => ({
          identifier: bb.id,
          latitude: bb.latitude,
          longitude: bb.longitude,
          radius: PROXIMITY_RADIUS,
          notifyOnEnter: true,
          notifyOnExit: false,
        }));

        // 4. Register with the OS
        // This will persist even if the app is closed
        await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
        console.log(`✅ Geofencing active: Monitoring ${regions.length} active zones at ${PROXIMITY_RADIUS}m radius.`);
      }

    } catch (err) {
      console.error('Geofencing setup failed:', err);
    }
  };

  /**
   * Cleanup: Stops all geofencing tasks.
   */
  const stopGeofencing = async () => {
    try {
      const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK_NAME);
      if (isRunning) {
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
        console.log('🛑 Geofencing stopped.');
      }
    } catch (e) {
      console.error('Failed to stop geofencing:', e);
    }
  };

  /**
   * Sync: Updates geofences based on a local list (useful after offline sync).
   */
  const syncGeofencesFromList = async (billboards: any[]) => {
    if (!billboards || billboards.length === 0) return;

    const regions = billboards
      .slice(0, 100) // Compliance
      .map(bb => ({
        identifier: bb.id,
        latitude: bb.latitude,
        longitude: bb.longitude,
        radius: PROXIMITY_RADIUS,
        notifyOnEnter: true,
        notifyOnExit: false,
      }));

    await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
  };

  return { setupGeofencing, stopGeofencing, syncGeofencesFromList };
};
