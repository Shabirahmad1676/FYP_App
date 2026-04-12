import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_OFFERS_KEY = 'OFFLINE_SAVED_OFFERS';

/**
 * Interface representing the cached offer data structure.
 */
export interface CachedOffer {
  billboard: any;
  campaign: any;
  redemptionCode: string | null;
  savedOfferId: string | null;
  savedAt: string;
}

/**
 * Saves an offer and its related data to local storage for offline access.
 */
export const saveOfferOffline = async (
  billboardId: string, 
  data: Omit<CachedOffer, 'savedAt'>
) => {
  try {
    const existingRaw = await AsyncStorage.getItem(OFFLINE_OFFERS_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    
    existing[billboardId] = {
      ...data,
      savedAt: new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(OFFLINE_OFFERS_KEY, JSON.stringify(existing));
    console.log(`💾 Cached offer ${billboardId} for offline access.`);
  } catch (error) {
    console.error('Failed to save offer offline:', error);
  }
};

/**
 * Retrieves a single offer from the offline cache.
 */
export const getOfflineOffer = async (billboardId: string): Promise<CachedOffer | null> => {
  try {
    const existingRaw = await AsyncStorage.getItem(OFFLINE_OFFERS_KEY);
    if (!existingRaw) return null;
    
    const existing = JSON.parse(existingRaw);
    return existing[billboardId] || null;
  } catch (error) {
    console.error('Failed to get offline offer:', error);
    return null;
  }
};

/**
 * Retrieves all saved offers from the offline cache.
 */
export const getAllOfflineOffers = async (): Promise<Record<string, CachedOffer>> => {
  try {
    const existingRaw = await AsyncStorage.getItem(OFFLINE_OFFERS_KEY);
    return existingRaw ? JSON.parse(existingRaw) : {};
  } catch (error) {
    console.error('Failed to get all offline offers:', error);
    return {};
  }
};

/**
 * Removes an offer from the offline cache.
 */
export const removeOfferOffline = async (billboardId: string) => {
  try {
    const existingRaw = await AsyncStorage.getItem(OFFLINE_OFFERS_KEY);
    if (!existingRaw) return;
    
    const existing = JSON.parse(existingRaw);
    delete existing[billboardId];
    
    await AsyncStorage.setItem(OFFLINE_OFFERS_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error('Failed to remove offline offer:', error);
  }
};
