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

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({ isDetected, campaign, billboardId }) => {
  const [saving, setSaving] = useState(false);

  if (!isDetected || !campaign) return null;

  const handleAction = async (type: 'coupon' | 'billboard') => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Login Required", "Please log in to save items to your wallet.");
        return;
      }

      const { error } = await supabase
        .from('saved_items')
        .insert({
          user_id: user.id,
          type,
          campaign_id: type === 'coupon' ? campaign.id : null,
          billboard_id: billboardId,
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert("Already Saved", `This ${type} is already in your wallet!`);
        } else {
          throw error;
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success! 🎊", `${type === 'coupon' ? 'Coupon' : 'Ad'} saved to your wallet.`);
      }
    } catch (err: any) {
      console.error('Save Error:', err.message);
      Alert.alert("Save Failed", "Could not save. Please try again.");
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
      Linking.openURL(url);
    } else {
      Alert.alert("Location not found", "Coordinates for this billboard are not available.");
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
            <Text style={styles.businessName}>{campaign.business_name}</Text>
            <Text style={styles.title}>{campaign.title}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.primaryBtn]}
              onPress={() => campaign.website_url && Linking.openURL(campaign.website_url)}
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
