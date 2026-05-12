import React from 'react';
import { render } from '@testing-library/react-native';
import ARScene from '../../components/AR/ARScene';
import {
  ViroARScene,
  ViroARImageMarker,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the sceneNavigator prop shape that ar-scanner.tsx injects */
const makeNavigatorProps = (overrides: Partial<{
  onDetected: (id: string) => void;
  onLost: () => void;
  targetId: string | null;
}> = {}) => ({
  sceneNavigator: {
    viroAppProps: {
      onDetected: jest.fn(),
      onLost: jest.fn(),
      targetId: null,
      ...overrides,
    },
  },
});

describe('ARScene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  test('renders ViroARScene root element', () => {
    const { UNSAFE_getByType } = render(
      <ARScene {...makeNavigatorProps()} />
    );
    expect(UNSAFE_getByType(ViroARScene as any)).toBeTruthy();
  });

  test('does NOT render ViroARImageMarker when targetId is null', () => {
    const { UNSAFE_queryByType } = render(
      <ARScene {...makeNavigatorProps({ targetId: null })} />
    );
    expect(UNSAFE_queryByType(ViroARImageMarker as any)).toBeNull();
  });

  test('renders ViroARImageMarker when a targetId is provided', () => {
    const { UNSAFE_getByType } = render(
      <ARScene {...makeNavigatorProps({ targetId: 'target_billboard-42' })} />
    );
    const marker = UNSAFE_getByType(ViroARImageMarker as any);
    expect(marker.props.target).toBe('target_billboard-42');
  });

  // ── Tracking state machine ────────────────────────────────────────────────

  test('onTrackingUpdated: TRACKING_NORMAL does not call onLost', () => {
    const onLost = jest.fn();
    const { UNSAFE_getByType } = render(
      <ARScene {...makeNavigatorProps({ onLost })} />
    );

    const scene = UNSAFE_getByType(ViroARScene as any);
    scene.props.onTrackingUpdated(
      ViroTrackingStateConstants.TRACKING_NORMAL,
      ViroTrackingStateConstants.TRACKING_REASON_NONE,
    );

    expect(onLost).not.toHaveBeenCalled();
  });

  test('onTrackingUpdated: non-normal state calls onLost', () => {
    const onLost = jest.fn();
    const { UNSAFE_getByType } = render(
      <ARScene {...makeNavigatorProps({ onLost })} />
    );

    const scene = UNSAFE_getByType(ViroARScene as any);
    scene.props.onTrackingUpdated(
      ViroTrackingStateConstants.TRACKING_UNAVAILABLE,
      ViroTrackingStateConstants.TRACKING_REASON_NONE,
    );

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  // ── Anchor events ─────────────────────────────────────────────────────────

  test('onAnchorFound calls onDetected with billboard ID derived from targetId', () => {
    const onDetected = jest.fn();
    const { UNSAFE_getByType } = render(
      <ARScene
        {...makeNavigatorProps({ targetId: 'target_bb-999', onDetected })}
      />
    );

    const marker = UNSAFE_getByType(ViroARImageMarker as any);
    marker.props.onAnchorFound();

    // The scene strips "target_" prefix to get the billboard ID
    expect(onDetected).toHaveBeenCalledWith('bb-999');
  });

  test('onAnchorRemoved calls onLost', () => {
    const onLost = jest.fn();
    const { UNSAFE_getByType } = render(
      <ARScene
        {...makeNavigatorProps({ targetId: 'target_bb-999', onLost })}
      />
    );

    const marker = UNSAFE_getByType(ViroARImageMarker as any);
    marker.props.onAnchorRemoved();

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  test('onAnchorFound and onAnchorRemoved work independently', () => {
    const onDetected = jest.fn();
    const onLost = jest.fn();
    const { UNSAFE_getByType } = render(
      <ARScene
        {...makeNavigatorProps({ targetId: 'target_test-1', onDetected, onLost })}
      />
    );

    const marker = UNSAFE_getByType(ViroARImageMarker as any);

    marker.props.onAnchorFound();
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onLost).not.toHaveBeenCalled();

    marker.props.onAnchorRemoved();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledTimes(1); // not called again
  });
});
