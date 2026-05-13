import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyBillboards } from '@/hooks/useNearbyBillboards';
import { useUserInterests, INTERESTS } from '@/hooks/useUserInterests';
import { useGeoNotifications } from '@/hooks/useGeoNotifications';
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';
import OfferCard from '@/components/ui/OfferCard';
import { getDistance, formatDistance } from '@/lib/utils';
import { SectionList } from 'react-native';

export default function DiscoverScreen() {
  const router = useRouter();
  const { location } = useLocation();
  const { selectedIds: userInterests } = useUserInterests();
  const { billboards, loading } = useNearbyBillboards(
    location?.coords.latitude || 34.1989, // Default Mardan
    location?.coords.longitude || 72.0404, // Corrected Mardan Longitude
    50 // Increased radius for prototype visibility
  );

  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const fetchSavedOffers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('saved_offers')
        .select('campaign_id')
        .eq('user_id', session.user.id);

      if (data) {
        setSavedIds(new Set(data.map(item => item.campaign_id)));
      }
    }
  };

  const { syncGeofencesFromList } = useGeoNotifications();

  useEffect(() => {
    fetchSavedOffers();

    // Senior Asset Pre-fetching: Reduce flickering and perceived latency
    if (billboards.length > 0) {
      // 1. Sync Geofencing regions for background alerts
      syncGeofencesFromList(billboards);

      // 2. Pre-fetch images 
      const urls = billboards.flatMap(bb =>
        bb.campaigns
          .filter((c: any) => c.is_active && c.media_url && c.media_type === 'image') // Only pre-fetch images
          .map((c: any) => c.media_url)
      );
      if (urls.length > 0) {
        Image.prefetch(urls);
        console.log(`Pre-fetched ${urls.length} campaign assets 🚀`);
      }
    }
  }, [billboards]);

  // Senior Verified Impressions Logic (1s Dwell Time)
  const viewabilityTimers = useRef<Record<string, any>>({});
  const { logEvent } = require('@/lib/analytics'); // Direct import to ensure no circular dependency

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    // 1. Clear timers for items that are no longer viewable
    const viewableIds = new Set(viewableItems.map((v: any) => v.item.id));
    Object.keys(viewabilityTimers.current).forEach(id => {
      if (!viewableIds.has(id)) {
        clearTimeout(viewabilityTimers.current[id]);
        delete viewabilityTimers.current[id];
      }
    });

    // 2. Start timers for newly viewable items
    viewableItems.forEach((v: any) => {
      const campaign = v.item;
      if (!viewabilityTimers.current[campaign.id]) {
        viewabilityTimers.current[campaign.id] = setTimeout(() => {
          logEvent('proximity', campaign.billboard_id, campaign.id);
          console.log(`Verified Impression logged for: ${campaign.title} (1s+ dwell) ✅`);
        }, 1000);
      }
    });
  }, []);

  const viewConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 50, // Ad must be at least 50% visible
    minimumViewTime: 500 // Initial check after 500ms
  });

  const filters = [{ id: 'all', label: 'All' }, ...INTERESTS];

  const processedCampaigns = useMemo(() => {
    const userLat = location?.coords.latitude || 34.1989;
    const userLon = location?.coords.longitude || 72.0404;

    let all: any[] = [];
    billboards.forEach(bb => {
      const distance = getDistance(userLat, userLon, bb.latitude, bb.longitude);
      bb.campaigns.forEach((c: any) => {
        if (c.is_active) {
          all.push({
            ...c,
            billboard: bb,
            distance,
            formattedDistance: formatDistance(distance)
          });
        }
      });
    });

    let filtered = all;
    if (activeFilter !== 'all') {
      filtered = all.filter(c => {
        const billboardCat = (c.billboard.category || '').toLowerCase();
        const filterName = activeFilter.toLowerCase();
        // Resilient matching: "Food" matches "food", "Retail" matches "retail", etc.
        return billboardCat.includes(filterName) || filterName.includes(billboardCat) ||
          (filterName === 'electronics' && billboardCat === 'tech');
      });
    }

    // Sort by distance
    filtered.sort((a, b) => a.distance - b.distance);

    const sections: { title: string; data: any[]; isNear: boolean }[] = [];

    const near = filtered.filter(c => c.distance <= 10);
    const far = filtered.filter(c => c.distance > 10);

    if (near.length > 0) {
      sections.push({ title: 'Near You', data: near, isNear: true });
    }

    if (far.length > 0) {
      sections.push({ title: 'Explore More', data: far, isNear: false });
    }

    return sections;
  }, [billboards, activeFilter, location]);

  const allFilteredItems = useMemo(() => {
    return processedCampaigns.flatMap(s => s.data);
  }, [processedCampaigns]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSavedOffers();
    // Nearby billboards hook handles its own refresh on coord change, 
    // but we can trigger a re-fetch if needed by other means.
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleSave = async (campaignId: string, billboardId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/(auth)/login');
      return;
    }

    if (savedIds.has(campaignId)) {
      // Remove
      const { error } = await supabase
        .from('saved_offers')
        .delete()
        .eq('user_id', session.user.id)
        .eq('campaign_id', campaignId);

      if (!error) {
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(campaignId);
          return next;
        });
      }
    } else {
      // Add
      const { error } = await supabase
        .from('saved_offers')
        .insert({
          user_id: session.user.id,
          campaign_id: campaignId,
          billboard_id: billboardId,
        });

      if (!error) {
        setSavedIds(prev => new Set([...prev, campaignId]));
      }
    }
  };

  const handleCampaignPress = (billboardId: string, campaignId: string) => {
    console.log('Navigating to billboard:', billboardId);
    logEvent('tap', billboardId, campaignId);
    router.push(`/billboard/${billboardId}`);
  };

  const renderFilterItem = ({ item }: { item: { id: string, label: string } }) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        activeFilter === item.id && styles.filterChipActive
      ]}
      onPress={() => setActiveFilter(item.id)}
    >
      <Text style={[
        styles.filterLabel,
        activeFilter === item.id && styles.filterLabelActive
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const getAutoSavedPreviewSource = (item: any): string | null => {
    const mediaUrl = item?.media_url || null;
    const billboardImage = item?.billboard?.image_target_url || null;
    const logo = item?.business_logo_url || null;
    const isVideo = item?.media_type === 'video' || mediaUrl?.includes('.mp4') || mediaUrl?.includes('gtv-videos-bucket');

    if (isVideo) {
      return billboardImage || logo || null;
    }

    return mediaUrl || billboardImage || logo || null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={14} color={Colors.textSecondary} />
            <Text style={styles.locationText}>Mardan, Pakistan</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={24} color={Colors.black} />
        </TouchableOpacity>
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          renderItem={renderFilterItem}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={styles.list}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={200} borderRadius={16} style={{ marginBottom: 16 }} />
              <View style={{ gap: 8 }}>
                <Skeleton width="40%" height={16} borderRadius={8} />
                <Skeleton width="90%" height={24} borderRadius={8} />
                <Skeleton width="60%" height={14} borderRadius={8} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <SectionList
          sections={processedCampaigns}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <>
              {savedIds.size > 0 && (
                <View style={styles.nearbySection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Auto-Saved for You</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/saved')}>
                      <Text style={styles.viewAll}>View All</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={allFilteredItems.filter(c => savedIds.has(c.id)).slice(0, 5)}
                    keyExtractor={item => `nearby-${item.id}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nearbyList}
                    renderItem={({ item }) => (
                      (() => {
                        const previewSource = getAutoSavedPreviewSource(item);
                        return (
                      <TouchableOpacity
                        style={styles.nearbyItem}
                        onPress={() => handleCampaignPress(item.billboard.id, item.id)}
                      >
                        <View style={styles.nearbyImageContainer}>
                          {previewSource ? (
                            <Image
                              source={previewSource}
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
                          <View style={styles.nearbyBadge}>
                            <Ionicons name="flash" size={12} color={Colors.white} />
                            <Text style={styles.nearbyBadgeText}>NEW</Text>
                          </View>
                        </View>
                        <Text style={styles.nearbyBusiness} numberOfLines={1}>{item.business_name}</Text>
                        <Text style={styles.nearbyOffer} numberOfLines={1}>{item.title}</Text>
                      </TouchableOpacity>
                        );
                      })()
                    )}
                  />
                </View>
              )}
            </>
          }
          renderSectionHeader={({ section: { title, isNear } }) => (
            <View style={styles.sectionTitleContainer}>
              <View style={styles.titleWithBadge}>
                <Text style={styles.groupSectionTitle}>{title}</Text>
                {isNear && (
                  <View style={styles.nearBadge}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.nearText}>LIVE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sectionSubtitle}>
                {isNear ? 'Handpicked deals closest to you' : 'Discover offers slightly further away'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            console.log(`🖼️ Loading Image for ${item.business_name}:`, {
              mediaUrl: item.media_url,
              billboardImage: item.billboard.image_target_url,
              mediaType: item.media_type
            }),
            <OfferCard
              businessName={item.business_name}
              businessLogo={item.business_logo_url}
              offerText={item.title}
              address={item.billboard.address}
              distance={item.formattedDistance}
              mediaUrl={item.media_url}
              mediaType={item.media_type}
              billboardImage={item.billboard.image_target_url}
              isSaved={savedIds.has(item.id)}
              onPress={() => handleCampaignPress(item.billboard.id, item.id)}
              onSave={() => toggleSave(item.id, item.billboard.id)}
            />
          )}
          contentContainerStyle={styles.list}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfigRef.current}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.black} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No active campaigns found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  skeletonCard: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersList: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterChipActive: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterLabelActive: {
    color: Colors.white,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  nearbySection: {
    marginBottom: 32,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.black,
  },
  viewAll: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  nearbyList: {
    gap: 16,
  },
  nearbyItem: {
    width: 160,
  },
  nearbyImageContainer: {
    width: 160,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  nearbyImage: {
    width: '100%',
    height: '100%',
  },
  nearbyImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  nearbyBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 2,
  },
  nearbyBadgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  nearbyBusiness: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
  },
  nearbyOffer: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionTitleContainer: {
    paddingVertical: 16,
    backgroundColor: Colors.white,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  nearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEFBF0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  nearText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34C759',
  },
});
