import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

interface ScannerOverlayProps {
  isDetected: boolean;
  campaign: any;
  billboardId: string | null;
}

const normalizeExternalUrl = (rawUrl?: string | null) => {
  if (!rawUrl) return null;

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return null;

  return /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
};

const formatSaveErrorMessage = (error: any) => {
  if (error?.code === '42501') {
    return 'Database permissions are not configured for saved_items yet. Run the saved_items SQL migration in Supabase, then try again.';
  }

  if (error?.code === '23505') {
    return 'This item is already in your wallet.';
  }

  return error?.message || 'Could not save. Please try again.';
};

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({ isDetected, campaign, billboardId }) => {
  const [saving, setSaving] = useState(false);

  // Guard: Don't render if not detected or if campaign is missing required fields
  if (
    !isDetected || 
    !campaign || 
    !campaign.business_name || 
    !campaign.title
  ) {
    return null;
  }

  const handleAction = async (type: 'coupon' | 'billboard') => {
    try {
      setSaving(true);
      console.log('[ScannerOverlay] handleAction called:', { type, billboardId, campaignId: campaign?.id });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('[ScannerOverlay] Auth check:', { user: user?.id, authError });

      if (!user) {
        console.warn('[ScannerOverlay] No authenticated user found');
        Alert.alert("Login Required", "Please log in to save items to your wallet.");
        return;
      }

      const insertPayload = {
        user_id: user.id,
        type,
        campaign_id: type === 'coupon' ? campaign.id : null,
        billboard_id: billboardId,
      };
      console.log('[ScannerOverlay] Insert payload:', insertPayload);
      console.log('[ScannerOverlay] Campaign data:', campaign);

      const { data, error } = await supabase
        .from('saved_items')
        .insert(insertPayload)
        .select();

      console.log('[ScannerOverlay] Insert response:', { data, error });

      if (error) {
        console.warn('[ScannerOverlay] Insert error details:', {
          code: error.code,
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
        });

        if (error.code === '23505') {
          Alert.alert("Already Saved", `This ${type} is already in your wallet!`);
        } else if (error.code === '42501') {
          Alert.alert('Save Blocked', formatSaveErrorMessage(error));
        } else {
          throw error;
        }
      } else {
        console.log('[ScannerOverlay] Save successful');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success! 🎊", `${type === 'coupon' ? 'Coupon' : 'Ad'} saved to your wallet.`);
      }
    } catch (err: any) {
      console.warn('[ScannerOverlay] Save Error caught:', {
        message: err.message,
        code: err.code,
        details: err.details,
        fullError: JSON.stringify(err, null, 2),
      });
      Alert.alert('Save Failed', formatSaveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openMaps = () => {
    const { latitude, longitude } = campaign.billboard || {};
    if (latitude && longitude) {
      // const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      const url = Platform.select({
        ios: `maps:0,0?q=${latitude},${longitude}`,
        android: `geo:0,0?q=${latitude},${longitude}`
      });

      if (!url) {
        console.warn('[ScannerOverlay] No maps URL generated', { latitude, longitude, platform: Platform.OS });
        Alert.alert('Location not found', 'Coordinates for this billboard are not available.');
        return;
      }

      Linking.openURL(url).catch((error) => {
        console.error('[ScannerOverlay] Failed to open maps URL', { url, error });
        Alert.alert('Open Maps Failed', 'Could not open your maps app on this device.');
      });
    } else {
      Alert.alert("Location not found", "Coordinates for this billboard are not available.");
    }
  };

  const openWebsite = async () => {
    const normalizedUrl = normalizeExternalUrl(campaign?.website_url);
    console.log('[ScannerOverlay] openWebsite called', {
      rawUrl: campaign?.website_url,
      normalizedUrl,
    });

    if (!normalizedUrl) {
      Alert.alert('Link unavailable', 'This offer does not have a valid website link.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(normalizedUrl);
      console.log('[ScannerOverlay] canOpenURL result', { normalizedUrl, supported });

      if (!supported) {
        Alert.alert('Link unavailable', 'This website link could not be opened on your device.');
        return;
      }

      await Linking.openURL(normalizedUrl);
    } catch (error) {
      console.error('[ScannerOverlay] Failed to open website URL', {
        rawUrl: campaign?.website_url,
        normalizedUrl,
        error,
      });
      Alert.alert('Open Link Failed', 'Could not open this website.');
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(500)}
      exiting={FadeOutDown.duration(400)}
      style={styles.overlay}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="gift" size={24} color={Colors.white} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.businessName}>{campaign.business_name || 'Brand'}</Text>
            <Text style={styles.title}>{campaign.title || 'Offer'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.primaryBtn]}
              onPress={() => {
                void openWebsite();
              }}
              disabled={!campaign.website_url}
            >
              <Ionicons name="globe-outline" size={20} color={Colors.white} />
              <Text style={styles.btnText}>Shop Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn]}
              onPress={() => handleAction('coupon')}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color={Colors.white} /> : (
                <>
                  <Ionicons name="ticket-outline" size={20} color={Colors.white} />
                  <Text style={styles.btnText}>Get Coupon</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => handleAction('billboard')}
              disabled={saving}
            >
              <Ionicons name="heart-outline" size={20} color={Colors.white} />
              <Text style={styles.btnText}>Save Ad</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btn} onPress={openMaps}>
              <Ionicons name="map-outline" size={20} color={Colors.white} />
              <Text style={styles.btnText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    padding: 24,
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
  card: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  businessName: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  actions: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
  },
  secondaryBtn: {
    backgroundColor: '#8B5CF6',
  },
  btnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ScannerOverlay;
