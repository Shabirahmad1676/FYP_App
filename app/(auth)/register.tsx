import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async () => {
    if (!email || !password || !fullName) return;
    setLoading(true);
    setError(null);
    
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      // Redirect to interests on first registration
      router.replace('/interests');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.branding}>BillboardAR</Text>
          <Text style={styles.title}>Create account</Text>
        </View>

        <View style={styles.form}>
          <Input
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button 
            title="Sign Up" 
            onPress={handleSignUp} 
            loading={loading}
            style={styles.signUpBtn}
          />

          <TouchableOpacity 
            style={styles.linkBtn} 
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  branding: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 24,
    color: Colors.black,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  form: {
    width: '100%',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  signUpBtn: {
    marginTop: 12,
    marginBottom: 24,
  },
  linkBtn: {
    alignSelf: 'center',
  },
  linkText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  linkHighlight: {
    color: Colors.black,
    fontWeight: '700',
  },
});
