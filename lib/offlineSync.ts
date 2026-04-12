import * as FileSystem from 'expo-file-system';
import { documentDirectory } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TARGET_DIR = `${documentDirectory}targets/`;
const CACHE_KEY = 'billboard_cache';

export async function ensureDirectoryExists() {
  const dirInfo = await FileSystem.getInfoAsync(TARGET_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(TARGET_DIR, { intermediates: true });
  }
}

export async function downloadTargetImage(url: string, billboardId: string): Promise<string> {
  await ensureDirectoryExists();
  const fileUri = `${TARGET_DIR}${billboardId}.jpg`;
  
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (fileInfo.exists) return fileUri;

  try {
    const downloadRes = await FileSystem.downloadAsync(url, fileUri);
    return downloadRes.uri;
  } catch (error) {
    console.error('Download failed:', error);
    return url; // Fallback to remote URL
  }
}

export async function saveToCache(data: any) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (error) {
    console.error('Cache save failed:', error);
  }
}

export async function getFromCache() {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached).data;
  } catch (error) {
    console.error('Cache read failed:', error);
    return null;
  }
}
