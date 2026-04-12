import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

import QRCode from 'react-native-qrcode-svg';
import { getAllOfflineOffers, saveOfferOffline } from '@/lib/offline_storage';

export default function SavedOffersScreen() {
  const router = useRouter();
  const [savedOffers, setSavedOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<{ id: string, code: string } | null>(null);

  const fetchSavedOffers = async () => {
    // 1. Instant Load from Cache
    if (loading) {
      const cached = await getAllOfflineOffers();
      if (Object.keys(cached).length > 0) {
        // Map cached format to UI format
        const mapped = Object.entries(cached).map(([id, item]) => ({
          id: `cached-${id}`,
          campaign_id: item.campaign.id,
          redemption_code: item.redemptionCode,
          is_offline: true,
          campaigns: {
            ...item.campaign,
            billboard: item.billboard
          }
        }));
        setSavedOffers(mapped);
        setLoading(false);
      }
    }

    // 2. Background Sync with Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSavedOffers([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('saved_offers')
      .select(`
        *,
        campaigns:campaign_id (
          *,
          billboard:billboard_id (*)
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedOffers(data);
      
      // 3. Update Sync Cache
      for (const item of data) {
        if (item.campaigns) {
          saveOfferOffline(item.campaigns.billboard.id, {
            billboard: item.campaigns.billboard,
            campaign: item.campaigns,
            redemptionCode: item.redemption_code,
            savedOfferId: item.id
          });
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSavedOffers();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSavedOffers();
    setRefreshing(false);
  };

  const handleRedeem = (id: string, code: string) => {
    setSelectedOffer({ id, code });
    setShowRedeemModal(true);
  };

  const renderItem = ({ item }: { item: any }) => {
    const campaign = item.campaigns;
    const isRedeemed = item.is_redeemed;

    return (
      <View style={[styles.card, isRedeemed && styles.cardRedeemed]}>
        <View style={styles.cardHeader}>
          <Image 
            source={campaign.media_type === 'video' ? (campaign.billboard?.image_target_url || campaign.business_logo_url) : campaign.business_logo_url} 
            style={styles.businessLogo} 
          />
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.offerTitle}>{campaign.title}</Text>
              {(item.is_offline || !item.id.includes('-')) && (
                <View style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>OFFLINE READY</Text>
                </View>
              )}
            </View>
            <Text style={styles.businessName}>{campaign.business_name}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.metaInfo}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>
              Expires {new Date(campaign.end_date).toLocaleDateString()}
            </Text>
          </View>

          {isRedeemed ? (
            <Badge label="Redeemed" variant="outline" style={styles.redeemBadge} />
          ) : (
            <TouchableOpacity
              style={styles.redeemBtn}
              onPress={() => handleRedeem(item.id, item.redemption_code)}
            >
              <Text style={styles.redeemBtnText}>Redeem Code</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.black} />
        </View>
      ) : (
        <FlatList
          data={savedOffers}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.black} />
          }
          ListEmptyComponent={
            !loading && !refreshing ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="bookmark-outline" size={48} color={Colors.black} />
                </View>
                <Text style={styles.emptyTitle}>Your wallet is empty</Text>
                <Text style={styles.emptySubtitle}>Explore nearby billboards to find exclusive deals and savings.</Text>
                <Button
                  title="Discover Offers"
                  onPress={() => router.push('/(tabs)')}
                  style={styles.emptyBtn}
                />
              </View>
            ) : null
          }
        />
      )}

      {/* Redemption Modal */}
      <Modal visible={showRedeemModal} transparent animationType="fade" onRequestClose={() => setShowRedeemModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowRedeemModal(false)}>
              <Ionicons name="close" size={24} color={Colors.black} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Redeem Offer</Text>
            <Text style={styles.modalSubtitle}>Show this QR code to the merchant to verify your discount</Text>
            <View style={styles.qrContainer}>
              <QRCode value={selectedOffer?.code || '0000'} size={200} />
            </View>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{selectedOffer?.code}</Text>
            </View>
            <Button title="Done" onPress={() => setShowRedeemModal(false)} style={{ width: '100%', marginTop: 24 }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    marginTop: Platform.OS === 'ios' ? 0 : 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  list: {
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRedeemed: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  businessLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
  },
  businessName: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  redeemBtn: {
    backgroundColor: Colors.black,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  redeemBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  redeemBadge: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.black,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyBtn: {
    width: '100%',
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
    borderRadius: 32,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalClose: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 10,
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
    marginBottom: 24,
    lineHeight: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 20,
  },
  codeBadge: {
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
