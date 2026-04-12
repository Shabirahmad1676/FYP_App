import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import Button from '@/components/ui/Button';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (!error) {
              router.replace('/(auth)/login');
            }
          }
        },
      ]
    );
  };

  const ProfileOption = ({ icon, label, onPress, value, isSwitch }: any) => (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isSwitch}
    >
      <View style={styles.optionLeft}>
        <View style={styles.optionIcon}>
          <Ionicons name={icon} size={20} color={Colors.black} />
        </View>
        <Text style={styles.optionLabel}>{label}</Text>
      </View>
      {isSwitch ? (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: '#E5E5E5', true: Colors.black }}
          thumbColor={Colors.white}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={Colors.border} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.substring(0, 1).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <TouchableOpacity onPress={() => router.push('/interests')}>
              <Text style={styles.editProfile}>Update Interests →</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <ProfileOption
            icon="notifications-outline"
            label="Push Notifications"
            isSwitch
            value={notificationsEnabled}
            onPress={() => setNotificationsEnabled(!notificationsEnabled)}
          />
          <ProfileOption
            icon="color-palette-outline"
            label="Design Preferences"
            onPress={() => { }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <ProfileOption
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => { }}
          />
          <ProfileOption
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => { }}
          />
          <ProfileOption
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => { }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <ProfileOption
            icon="construct-outline"
            label="Billboard Creator (AR)"
            onPress={() => router.push('/admin/creator')}
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.Version}>BillboardAR v1.0.0 Premium</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
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
  content: {
    padding: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#000',
    padding: 24,
    borderRadius: 20,
    marginBottom: 32,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.black,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  editProfile: {
    fontSize: 14,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.black,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFF1F0',
    borderRadius: 16,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.error,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 40,
  },
  Version: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
