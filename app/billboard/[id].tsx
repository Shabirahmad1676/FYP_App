import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { formatDistanceToNow, isAfter, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import MediaViewer from '@/components/MediaViewer';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { logEvent } from '@/lib/analytics';
import { saveOfferOffline, getOfflineOffer } from '@/lib/offline_storage';
import Skeleton from '@/components/ui/Skeleton';

export default function BillboardDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [billboard, setBillboard] = useState<any>(null);
  const [nearbyBillboards, setNearbyBillboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isRedeemed, setIsRedeemed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [savedOfferId, setSavedOfferId] = useState<string | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [isOfflineData, setIsOfflineData] = useState(false);

  const activeCampaign = billboard?.campaigns?.find((c: any) => c.is_active);

  const getCampaignPreviewSource = (campaign: any, fallbackBillboard?: any): string | null => {
    const mediaUrl = campaign?.media_url || null;
    const billboardImage = fallbackBillboard?.image_target_url || billboard?.image_target_url || null;
    const logo = campaign?.business_logo_url || null;
    const isVideo = campaign?.media_type === 'video' || mediaUrl?.includes('.mp4') || mediaUrl?.includes('gtv-videos-bucket');

    if (isVideo) {
      return billboardImage || logo || null;
    }

    return mediaUrl || billboardImage || logo || null;
  };

  const detailMediaSource = activeCampaign
    ? (activeCampaign.media_type === 'video' && activeCampaign.media_url
      ? activeCampaign.media_url
      : getCampaignPreviewSource(activeCampaign, billboard))
    : null;

  const detailMediaType: 'image' | 'video' =
    activeCampaign?.media_type === 'video' && !!activeCampaign?.media_url ? 'video' : 'image';

  // ... (Keep your existing useEffects for Countdown and Fetching) ...
  useEffect(() => {
    if (!activeCampaign?.end_date) return;
    const updateCountdown = () => {
      const end = parseISO(activeCampaign.end_date);
      setCountdown(isAfter(end, new Date()) ? formatDistanceToNow(end) : 'Expired');
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [activeCampaign]);

  useEffect(() => {
    const fetchBillboard = async () => {
      try {
        const { data, error } = await supabase
          .from('billboards')
          .select('*, campaigns(*)')
          .eq('id', id)
          .single();

        if (!error && data) {
          setBillboard(data);
          setIsOfflineData(false);
          const campaign = data.campaigns?.find((c: any) => c.is_active);

          const { data: nearby } = await supabase
            .from('billboards')
            .select('*, campaigns(*)')
            .neq('id', id)
            .not('owner_id', 'is', null)
            .limit(5);
          if (nearby) setNearbyBillboards(nearby);

          const { data: { session } } = await supabase.auth.getSession();
          if (session && campaign) {
            const { data: saved } = await supabase
              .from('saved_offers')
              .select('id, redemption_code, is_redeemed')
              .eq('user_id', session.user.id)
              .eq('campaign_id', campaign.id)
              .maybeSingle();

            if (saved) {
              setIsSaved(true);
              setIsRedeemed(saved.is_redeemed);
              setRedemptionCode(saved.redemption_code);
              setSavedOfferId(saved.id);
              saveOfferOffline(id as string, {
                billboard: data,
                campaign: campaign,
                redemptionCode: saved.redemption_code,
                savedOfferId: saved.id
              });
            }
          }
        } else {
          throw error || new Error('Not found');
        }
      } catch (err) {
        console.log('🌐 Online fetch failed, checking local cache...');
        const cached = await getOfflineOffer(id as string);
        if (cached) {
          setBillboard(cached.billboard);
          setIsSaved(true);
          setRedemptionCode(cached.redemptionCode);
          setIsOfflineData(true);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBillboard();
  }, [id]);

  const handleSave = async () => {
    if (!activeCampaign) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/(auth)/login'); return null; }
    if (isSaved) return redemptionCode;

    try {
      setIsSaving(true);
      const { data: saved, error } = await supabase
        .from('saved_offers')
        .insert({ 
          user_id: session.user.id, 
          campaign_id: activeCampaign.id,
          billboard_id: id // Connecting the claim to the billboard for merchant analytics
        })
        .select('id, redemption_code')
        .maybeSingle();

      if (error && error.code !== '23505') throw error;

      let code = saved?.redemption_code;
      let sId = saved?.id;
      if (!code) {
        const { data: existing } = await supabase
          .from('saved_offers')
          .select('id, redemption_code')
          .eq('user_id', session.user.id)
          .eq('campaign_id', activeCampaign.id)
          .maybeSingle();
        code = existing?.redemption_code;
        sId = existing?.id;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSaved(true);
      setRedemptionCode(code);
      setSavedOfferId(sId || null);

      saveOfferOffline(id as string, {
        billboard: billboard,
        campaign: activeCampaign,
        redemptionCode: code,
        savedOfferId: sId || null
      });

      return code;
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRedeem = async () => {
    if (!isSaved) {
      const code = await handleSave();
      if (code) setShowRedeemModal(true);
    } else {
      setShowRedeemModal(true);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Skeleton height={300} width="100%" borderRadius={0} />
        <View style={{ padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={{ gap: 4 }}>
              <Skeleton width={120} height={18} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Skeleton width={60} height={14} />
                <Skeleton width={60} height={14} />
              </View>
            </View>
          </View>
          <Skeleton width="80%" height={32} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="90%" height={16} style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={50} borderRadius={12} style={{ marginTop: 32 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Absolute Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={Colors.black} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Top Media Section */}
        {activeCampaign && detailMediaSource && (
          <MediaViewer
            url={detailMediaSource}
            type={detailMediaType}
          />
        )}

        {/* Content Section */}
        <View style={styles.detailsContainer}>
          <View style={styles.businessRow}>
            <Image source={activeCampaign?.business_logo_url} style={styles.businessLogo} />
            <View style={styles.businessText}>
              <Text style={styles.businessName}>{activeCampaign?.business_name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Badge label={billboard?.category || 'Retail'} variant="outline" />
                <Badge label={billboard?.city || 'Mardan'} variant="outline" />
              </View>
            </View>
          </View>

          <Text style={styles.offerTitle}>{activeCampaign?.title}</Text>
          <Text style={styles.offerDescription}>{activeCampaign?.description}</Text>

          <View style={styles.badgeRow}>
            {isOfflineData && (
              <Badge label="Offline Mode" variant="outline" />
            )}
            {countdown && (
              <Badge
                label={countdown === 'Expired' ? 'Expired' : `Ends in ${countdown}`}
                variant={countdown === 'Expired' ? 'error' : 'success'}
              />
            )}
            {activeCampaign?.discount && (
              <Badge label={activeCampaign.discount} variant="success" />
            )}
            <Badge label="Limited Time" variant="outline" />
          </View>

          <View style={styles.divider} />

          {/* Hierarchical Action Bar */}
          <View style={styles.actionContainer}>
            {isRedeemed ? (
              <View style={styles.redeemedBadgeContainer}>
                <Ionicons name="checkmark-done-circle" size={24} color={Colors.success} />
                <Text style={styles.redeemedText}>THIS COUPON HAS BEEN REDEEMED</Text>
              </View>
            ) : (
              <Button
                title="Redeem Now"
                onPress={handleRedeem}
                style={styles.primaryBtn}
                textStyle={styles.primaryBtnText}
                icon={<Ionicons name="qr-code-outline" size={20} color={Colors.white} />}
              />
            )}
            
            <View style={styles.secondaryRow}>
              <Button
                title={isSaved ? "Saved" : "Save Offer"}
                onPress={handleSave}
                variant={isSaved ? "secondary" : "primary"}
                style={styles.secondaryBtn}
                disabled={isSaved || isSaving || isRedeemed}
                loading={isSaving}
                icon={<Ionicons name={isSaved ? "checkmark-circle" : "bookmark-outline"} size={18} color={isSaved ? Colors.success : Colors.black} />}
              />
              <Button
                title="Directions"
                variant="secondary"
                onPress={() => router.push({ pathname: '/(tabs)/map', params: { navigateId: id } })}
                style={styles.secondaryBtn}
                icon={<Ionicons name="map-outline" size={18} color={Colors.black} />}
              />
            </View>
          </View>

          {(activeCampaign?.hours || activeCampaign?.contact) && (
            <View style={{ marginTop: 24, gap: 12 }}>
              {activeCampaign.hours && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
                  <Text style={{ color: Colors.textSecondary }}>{activeCampaign.hours}</Text>
                </View>
              )}
              {activeCampaign.contact && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
                  <Text style={{ color: Colors.textSecondary }}>{activeCampaign.contact}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.divider} />

          {/* Nearby Section */}
          {nearbyBillboards.length > 0 && (
            <View style={styles.nearbySection}>
              <Text style={styles.sectionTitle}>Nearby Offers</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyScroll}>
                {nearbyBillboards.map((nb) => {
                  const nearbyCampaign = nb.campaigns?.find((c: any) => c.is_active) || nb.campaigns?.[0];
                  const nearbyPreviewSource = getCampaignPreviewSource(nearbyCampaign, nb);

                  return (
                    <TouchableOpacity key={nb.id} style={styles.nearbyCard} onPress={() => router.push(`/billboard/${nb.id}`)}>
                      {nearbyPreviewSource ? (
                        <Image
                          source={nearbyPreviewSource}
                          style={styles.nearbyImage}
                          contentFit="cover"
                          transition={250}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={styles.nearbyImageFallback}>
                          <Ionicons name="image-outline" size={20} color={Colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.nearbyInfo}>
                        <Text style={styles.nearbyBusiness}>{nearbyCampaign?.business_name || 'Offer'}</Text>
                        <Text style={styles.nearbyOffer} numberOfLines={1}>{nearbyCampaign?.title || 'No title available'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Redemption Modal - Stays as is since it's a separate popup */}
      <Modal visible={showRedeemModal} transparent animationType="fade" onRequestClose={() => setShowRedeemModal(false)}>
        {/* ... (Existing Modal Content) ... */}
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowRedeemModal(false)}>
              <Ionicons name="close" size={24} color={Colors.black} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Redeem Offer</Text>
            <View style={styles.qrContainer}>
              <QRCode value={savedOfferId || (id as string)} size={200} />
            </View>
            {redemptionCode && (
              <View style={{
                backgroundColor: '#F7F7F7',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#EEE',
                marginTop: 12
              }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: Colors.black,
                  letterSpacing: 2,
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                }}>{redemptionCode}</Text>
              </View>
            )}
            <Button title="Done" onPress={() => setShowRedeemModal(false)} style={{ width: '100%', marginTop: 24 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    marginTop: 28,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  sheetHandle: {
    backgroundColor: Colors.black,
    width: 40,
  },
  sheetContent: {
    flex: 1,
  },
  detailsContainer: {
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 60, // Extra padding to ensure bottom content is visible
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  businessLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
  },
  businessText: {
    gap: 4,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
  },
  offerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  offerDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  expiryRow: {
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  actionContainer: {
    marginTop: 8,
    gap: 12,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.black,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
  },
  savedBtn: {
    borderColor: Colors.success,
  },
  actionRowSecondary: {
    flexDirection: 'row',
    marginTop: 12,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.black,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  qrCodeText: {
    marginTop: 16,
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  aboutSection: {
    // gap: 12,
    // paddingBottom: 40,
  },
  nearbySection: {
    gap: 16,
    marginBottom: 10,
    // backgroundColor: 'red'
  },
  nearbyScroll: {
    gap: 16,
  },
  nearbyCard: {
    width: 200,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nearbyImage: {
    width: '100%',
    height: 100,
  },
  nearbyImageFallback: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  nearbyInfo: {
    padding: 12,
  },
  nearbyBusiness: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  nearbyOffer: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
  },
  redeemedBadgeContainer: {
    backgroundColor: '#EEFBF0',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  redeemedText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  aboutText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
