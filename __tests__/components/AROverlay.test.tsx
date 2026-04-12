import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AROverlay from '../../components/AR/AROverlay';
import { logEvent } from '../../lib/analytics';

// Mock analytics to spy on calls
jest.mock('../../lib/analytics', () => ({
  logEvent: jest.fn(),
}));

describe('AROverlay (Level 2 Component Tests)', () => {
  const defaultProps = {
    billboardId: 'test-bb-123',
    campaignId: 'test-cp-456',
    businessName: 'UET Mardan Cafe',
    offerText: '20% OFF ALL LUNCHES',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders business name and offer correctly', () => {
    // Note: ViroText is mocked as a regular component that displays text
    const { getByText } = render(<AROverlay {...defaultProps} />);
    
    expect(getByText('UET Mardan Cafe')).toBeTruthy();
    expect(getByText('20% OFF ALL LUNCHES')).toBeTruthy();
  });

  test('triggers tap analytics and call onPress when clicked', async () => {
    const { getByText } = render(<AROverlay {...defaultProps} />);
    
    // Simulate click on the card
    // Since ViroFlexView is mocked, we can interact with it via its text content
    const card = getByText('UET Mardan Cafe');
    fireEvent.press(card);

    // 1. Verify tap analytics event
    expect(logEvent).toHaveBeenCalledWith('tap', 'test-bb-123', 'test-cp-456');

    // 2. Verify navigation callback (after animation timeout)
    await waitFor(() => {
      expect(defaultProps.onPress).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  test('implements gaze-based monetization validation via onFuse', () => {
    // This tests the internal logic of handleGaze
    // In our mock, ViroNodeAny (ViroNode) receives the onFuse prop
    const { UNSAFE_getByType } = render(<AROverlay {...defaultProps} />);
    
    // Get the ViroNode (mocked as a component with the same name)
    const node = UNSAFE_getByType('ViroNode');
    
    // Simulate the onFuse event (gaze for 3s)
    const onFuseCallback = node.props.onFuse.callback;
    onFuseCallback();

    // Verify ar_view_3s analytics event
    expect(logEvent).toHaveBeenCalledWith('ar_view_3s', 'test-bb-123', 'test-cp-456');
  });
});
