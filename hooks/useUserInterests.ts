import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const INTERESTS = [
  { id: 'food', label: 'Food & Dining', icon: 'restaurant-outline' },
  { id: 'fashion', label: 'Fashion', icon: 'shirt-outline' },
  { id: 'electronics', label: 'Electronics', icon: 'phone-portrait-outline' },
  { id: 'healthcare', label: 'Healthcare', icon: 'medical-outline' },
  { id: 'education', label: 'Education', icon: 'book-outline' },
  { id: 'automotive', label: 'Automotive', icon: 'car-outline' },
  { id: 'sports', label: 'Sports', icon: 'football-outline' },
  { id: 'beauty', label: 'Beauty', icon: 'sparkles-outline' },
  { id: 'home', label: 'Home & Living', icon: 'home-outline' },
  { id: 'travel', label: 'Travel', icon: 'airplane-outline' },
];

export const useUserInterests = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInterests = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from('user_interests')
      .select('interest')
      .eq('user_id', session.user.id);

    if (!error && data) {
      setSelectedIds(data.map(item => item.interest));
    }
  };

  useEffect(() => {
    fetchInterests();
  }, []);

  const saveInterests = async (interests: string[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return { error: 'No user session' };

    setLoading(true);

    // Delete existing
    const { error: deleteError } = await supabase
      .from('user_interests')
      .delete()
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('Error deleting interests:', deleteError);
      setLoading(false);
      return { error: deleteError };
    }

    // Insert new
    const { error: insertError } = await supabase
      .from('user_interests')
      .insert(interests.map(interest => ({
        user_id: session.user.id,
        interest,
      })));

    if (insertError) {
      console.error('Error inserting interests:', insertError);
    }

    setLoading(false);
    return { error: insertError };
  };

  return {
    selectedIds,
    setSelectedIds,
    loading,
    fetchInterests,
    saveInterests,
  };
};
