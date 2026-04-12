import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import Button from '@/components/ui/Button';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';

const CATEGORIES = [
  { id: 'Food', icon: 'fast-food' },
  { id: 'Tech', icon: 'laptop' },
  { id: 'Fashion', icon: 'shirt' },
  { id: 'Health', icon: 'heart' },
  { id: 'Home', icon: 'home' },
  { id: 'Auto', icon: 'car' },
  { id: 'Education', icon: 'book' },
  { id: 'Travel', icon: 'airplane' },
];

export default function InterestsScreen() {
  const { setHasSelectedInterests } = useAuth();
  const router = useRouter();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInterests();
  }, []);

  const fetchInterests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('interests')
        .eq('id', session.user.id)
        .single();

      if (data?.interests) {
        setSelectedInterests(data.interests);
      }
    } catch (err) {
      console.error('Fetch interests error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('profiles')
        .update({ interests: selectedInterests })
        .eq('id', session.user.id);

      console.log('DEBUG: Interests update error:', error);
      console.log('DEBUG: Selected interests saved:', selectedInterests);

      if (!error) {
        await AsyncStorage.setItem('hasSelectedInterests', 'true');
        setHasSelectedInterests(true);
        router.replace('/(tabs)');
      } else {
        console.error('DEBUG: Save failed with error:', error);
      }
    } catch (err) {
      console.error('Save interests error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.black} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Interests</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>What are you looking for today?</Text>
        <Text style={styles.subtitle}>
          Select categories to highlight relevant billboards on your map.
        </Text>

        <View style={styles.grid}>
          {CATEGORIES.map(cat => {
            const isSelected = selectedInterests.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleInterest(cat.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={24}
                  color={isSelected ? Colors.white : Colors.black}
                />
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {cat.id}
                </Text>
                {isSelected && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={saving ? "Saving..." : "Save Preferences"}
          onPress={handleSave}
          disabled={saving}
          style={styles.saveBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.black,

  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.black,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    width: '48%',
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.black,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    width: '100%',
  },
});
