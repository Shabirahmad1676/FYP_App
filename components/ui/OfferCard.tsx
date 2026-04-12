import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import Card from './Card';
import Badge from './Badge';

interface OfferCardProps {
  businessName: string;
  businessLogo: string;
  offerText: string;
  address: string;
  distance?: string;
  mediaUrl: string;
  mediaType?: 'image' | 'video' | 'glb';
  billboardImage?: string;
  onPress: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  style?: StyleProp<ViewStyle>;
}

const OfferCard: React.FC<OfferCardProps> = ({
  businessName,
  businessLogo,
  offerText,
  address,
  distance,
  mediaUrl,
  mediaType,
  billboardImage,
  onPress,
  onSave,
  isSaved,
  style,
}) => {
  // Fallback Logic: If it's a video/glb, or the URL looks like a bucket video, 
  // we use the billboardImage (Image Target) or Business Logo as the 2D visual.
  const isVideo = mediaType === 'video' || mediaUrl?.includes('.mp4') || mediaUrl?.includes('gtv-videos-bucket');
  const displayImage = isVideo ? (billboardImage || businessLogo) : (mediaUrl || businessLogo);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Card style={[styles.container, style]}>
        <View style={styles.header}>
          <View style={styles.businessInfo}>
            <Image source={businessLogo} style={styles.logo} contentFit="cover" />
            <View>
              <Text style={styles.businessName}>{businessName}</Text>
              <Text style={styles.address}>{address}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onSave} style={styles.saveBtn}>
            <Ionicons 
              name={isSaved ? "bookmark" : "bookmark-outline"} 
              size={22} 
              color={Colors.black} 
            />
          </TouchableOpacity>
        </View>

        <Image 
          source={displayImage} 
          style={styles.media} 
          contentFit="cover" 
          transition={300}
          cachePolicy="memory-disk"
        />

        <View style={styles.footer}>
          <Text style={styles.offerText}>{offerText}</Text>
          {distance && (
            <View style={styles.distanceContainer}>
              <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  businessName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
  },
  address: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  saveBtn: {
    padding: 4,
  },
  media: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.surface,
  },
  footer: {
    padding: 16,
    gap: 8,
  },
  offerText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.black,
    lineHeight: 22,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});

export default OfferCard;
