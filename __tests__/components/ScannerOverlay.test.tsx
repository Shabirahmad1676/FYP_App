import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, Linking, Platform } from 'react-native';
import ScannerOverlay from '../../components/AR/ScannerOverlay';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    default: { View },
    View,
    FadeInUp: { duration: () => ({}) },
    FadeOutDown: { duration: () => ({}) },
  };
});

jest.spyOn(Alert, 'alert');
jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCampaign = {
  id: 'campaign-abc',
  title: '20% OFF All Lunches',
  business_name: 'UET Mardan Cafe',
  website_url: 'https://cafe.example.com',
  billboard: {
    latitude: 34.198,
    longitude: 72.043,
  },
};

const defaultProps = {
  isDetected: true,
  campaign: mockCampaign,
  billboardId: 'billboard-123',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset supabase mock to the happy-path default for each test */
const mockAuthUser = (userId = 'user-xyz') => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
};

const mockInsertSuccess = () => {
  (supabase.from as jest.Mock).mockReturnValue({
    insert: jest.fn().mockResolvedValue({ error: null }),
  });
};

const mockInsertError = (code: string, message = 'DB error') => {
  (supabase.from as jest.Mock).mockReturnValue({
    insert: jest.fn().mockResolvedValue({ error: { code, message } }),
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScannerOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser();
    mockInsertSuccess();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('renders nothing when isDetected is false', () => {
    const { toJSON } = render(
      <ScannerOverlay {...defaultProps} isDetected={false} />
    );
    expect(toJSON()).toBeNull();
  });

  test('renders nothing when campaign is null', () => {
    const { toJSON } = render(
      <ScannerOverlay {...defaultProps} campaign={null} />
    );
    expect(toJSON()).toBeNull();
  });

  test('renders campaign details when detected', () => {
    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    expect(getByText('UET Mardan Cafe')).toBeTruthy();
    expect(getByText('20% OFF All Lunches')).toBeTruthy();
  });

  // ── Save to Wallet — happy path ───────────────────────────────────────────

  test('Get Coupon: inserts into saved_items with correct payload', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });

    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Get Coupon')); });

    expect(supabase.from).toHaveBeenCalledWith('saved_items');
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-xyz',
      type: 'coupon',
      campaign_id: 'campaign-abc',
      billboard_id: 'billboard-123',
    });
  });

  test('Save Ad: inserts into saved_items with type "billboard"', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });

    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Save Ad')); });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'billboard', campaign_id: null })
    );
  });

  test('shows success alert and fires haptic after successful save', async () => {
    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Get Coupon')); });

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success! 🎊',
      expect.stringContaining('Coupon')
    );
  });

  // ── Duplicate insert (Supabase error 23505) ───────────────────────────────

  test('shows "Already Saved" alert on duplicate insert (error code 23505)', async () => {
    mockInsertError('23505', 'duplicate key value violates unique constraint');

    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Get Coupon')); });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Already Saved',
      expect.stringContaining('coupon')
    );
    // Haptic should NOT fire on duplicate
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  test('shows generic error alert on non-duplicate DB errors', async () => {
    mockInsertError('42501', 'permission denied');

    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Get Coupon')); });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Save Failed',
      expect.any(String)
    );
  });

  // ── Unauthenticated user ──────────────────────────────────────────────────

  test('shows login required alert when user is not authenticated', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Get Coupon')); });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Login Required',
      expect.any(String)
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ── Platform Maps URL ─────────────────────────────────────────────────────

  test('Open in Maps uses "maps:" scheme on iOS', async () => {
    jest.spyOn(Platform, 'select').mockImplementationOnce((spec: any) => spec.ios);

    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Open in Maps')); });

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringMatching(/^maps:/)
    );
  });

  test('Open in Maps uses "geo:" scheme on Android', async () => {
    jest.spyOn(Platform, 'select').mockImplementationOnce((spec: any) => spec.android);

    const { getByText } = render(<ScannerOverlay {...defaultProps} />);
    await act(async () => { fireEvent.press(getByText('Open in Maps')); });

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringMatching(/^geo:/)
    );
  });

  test('shows alert when billboard has no coordinates', async () => {
    const campaignNoCoords = {
      ...mockCampaign,
      billboard: { latitude: null, longitude: null },
    };

    const { getByText } = render(
      <ScannerOverlay {...defaultProps} campaign={campaignNoCoords} />
    );
    await act(async () => { fireEvent.press(getByText('Open in Maps')); });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Location not found',
      expect.any(String)
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
