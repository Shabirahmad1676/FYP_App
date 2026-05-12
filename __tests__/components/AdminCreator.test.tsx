import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import AdminARScene from '../../components/AR/AdminARScene';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Module-level mocks for AdminCreator screen tests
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Alert spy reused across both describe blocks
jest.spyOn(Alert, 'alert');

// ---------------------------------------------------------------------------
// Helpers: build AdminARScene sceneNavigator prop
// ---------------------------------------------------------------------------

const makeAdminSceneProps = (overrides: Record<string, any> = {}) => ({
  sceneNavigator: {
    viroAppProps: {
      isHosting: true,
      onAnchorHosted: jest.fn(),
      setScanStatus: jest.fn(),
      onTrackingUpdated: jest.fn(),
      glbUrl: 'https://example.com/model.glb',
      physicalWidth: 2.5,
      ...overrides.viroAppProps,
    },
    hostCloudAnchor: jest.fn().mockResolvedValue({
      success: true,
      cloudAnchorId: 'cloud-anchor-001',
    }),
    ...overrides.sceneNavigator,
  },
});

// ---------------------------------------------------------------------------
// AdminARScene unit tests (cloud anchor logic)
// ---------------------------------------------------------------------------

describe('AdminARScene — Cloud Anchor Hosting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders ViroARScene root', () => {
    const { UNSAFE_getByType } = render(
      <AdminARScene {...makeAdminSceneProps()} />
    );
    const { ViroARScene } = require('@reactvision/react-viro');
    expect(UNSAFE_getByType(ViroARScene)).toBeTruthy();
  });

  test('renders ghost ViroBox alignment indicator', () => {
    const { UNSAFE_getByType } = render(
      <AdminARScene {...makeAdminSceneProps()} />
    );
    const { ViroBox } = require('@reactvision/react-viro');
    const box = UNSAFE_getByType(ViroBox);
    expect(box.props.materials).toContain('ghost');
  });

  test('renders ghost Viro3DObject preview when glbUrl is provided', () => {
    const { UNSAFE_getByType } = render(
      <AdminARScene {...makeAdminSceneProps()} />
    );
    const { Viro3DObject } = require('@reactvision/react-viro');
    const model = UNSAFE_getByType(Viro3DObject);
    expect(model.props.source.uri).toBe('https://example.com/model.glb');
    expect(model.props.materials).toContain('ghost');
  });

  test('does NOT render Viro3DObject when glbUrl is absent', () => {
    const props = makeAdminSceneProps({
      viroAppProps: { glbUrl: undefined },
    });
    const { UNSAFE_queryByType } = render(<AdminARScene {...props} />);
    const { Viro3DObject } = require('@reactvision/react-viro');
    expect(UNSAFE_queryByType(Viro3DObject)).toBeNull();
  });

  test('ViroNode scale reflects physicalWidth prop', () => {
    const { UNSAFE_getAllByType } = render(
      <AdminARScene {...makeAdminSceneProps()} />
    );
    const { ViroNode } = require('@reactvision/react-viro');
    const nodes = UNSAFE_getAllByType(ViroNode);
    // The scaling node wraps the box + model
    const scalingNode = nodes.find(
      (n: any) => Array.isArray(n.props.scale) && n.props.scale[0] === 2.5
    );
    expect(scalingNode).toBeTruthy();
  });

  test('handlePlaneSelected: calls hostCloudAnchor with TTL of 365', async () => {
    const hostCloudAnchor = jest.fn().mockResolvedValue({
      success: true,
      cloudAnchorId: 'cloud-anchor-001',
    });
    const props = makeAdminSceneProps({ sceneNavigator: { hostCloudAnchor } });

    const { UNSAFE_getByType } = render(<AdminARScene {...props} />);
    const { ViroARPlaneSelector } = require('@reactvision/react-viro');
    const selector = UNSAFE_getByType(ViroARPlaneSelector);

    await act(async () => {
      await selector.props.onPlaneSelected({ anchorId: 'native-anchor-xyz' });
    });

    expect(hostCloudAnchor).toHaveBeenCalledWith('native-anchor-xyz', 365);
  });

  test('handlePlaneSelected success: sets status to "hosting" then calls onAnchorHosted', async () => {
    const onAnchorHosted = jest.fn();
    const setScanStatus = jest.fn();
    const hostCloudAnchor = jest.fn().mockResolvedValue({
      success: true,
      cloudAnchorId: 'cloud-anchor-001',
    });

    const props = makeAdminSceneProps({
      viroAppProps: { onAnchorHosted, setScanStatus },
      sceneNavigator: { hostCloudAnchor },
    });

    const { UNSAFE_getByType } = render(<AdminARScene {...props} />);
    const { ViroARPlaneSelector } = require('@reactvision/react-viro');

    await act(async () => {
      await UNSAFE_getByType(ViroARPlaneSelector).props.onPlaneSelected({
        anchorId: 'native-anchor-xyz',
      });
    });

    expect(setScanStatus).toHaveBeenCalledWith('hosting');
    expect(onAnchorHosted).toHaveBeenCalledWith('cloud-anchor-001');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    );
  });

  test('handlePlaneSelected failure: resets status to "idle", does NOT call onAnchorHosted', async () => {
    const onAnchorHosted = jest.fn();
    const setScanStatus = jest.fn();
    const hostCloudAnchor = jest.fn().mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    const props = makeAdminSceneProps({
      viroAppProps: { onAnchorHosted, setScanStatus },
      sceneNavigator: { hostCloudAnchor },
    });

    const { UNSAFE_getByType } = render(<AdminARScene {...props} />);
    const { ViroARPlaneSelector } = require('@reactvision/react-viro');

    await act(async () => {
      await UNSAFE_getByType(ViroARPlaneSelector).props.onPlaneSelected({
        anchorId: 'native-anchor-xyz',
      });
    });

    expect(onAnchorHosted).not.toHaveBeenCalled();
    expect(setScanStatus).toHaveBeenCalledWith('idle');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  test('handlePlaneSelected thrown error: resets status to "idle"', async () => {
    const setScanStatus = jest.fn();
    const hostCloudAnchor = jest.fn().mockRejectedValue(new Error('timeout'));

    const props = makeAdminSceneProps({
      viroAppProps: { setScanStatus },
      sceneNavigator: { hostCloudAnchor },
    });

    const { UNSAFE_getByType } = render(<AdminARScene {...props} />);
    const { ViroARPlaneSelector } = require('@reactvision/react-viro');

    await act(async () => {
      await UNSAFE_getByType(ViroARPlaneSelector).props.onPlaneSelected({
        anchorId: 'native-anchor-xyz',
      });
    });

    expect(setScanStatus).toHaveBeenLastCalledWith('idle');
  });

  test('does NOT call hostCloudAnchor when isHosting is false', async () => {
    const hostCloudAnchor = jest.fn();
    const props = makeAdminSceneProps({
      viroAppProps: { isHosting: false },
      sceneNavigator: { hostCloudAnchor },
    });

    const { UNSAFE_getByType } = render(<AdminARScene {...props} />);
    const { ViroARPlaneSelector } = require('@reactvision/react-viro');

    await act(async () => {
      await UNSAFE_getByType(ViroARPlaneSelector).props.onPlaneSelected({
        anchorId: 'native-anchor-xyz',
      });
    });

    expect(hostCloudAnchor).not.toHaveBeenCalled();
  });
});

