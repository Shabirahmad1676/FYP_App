import '@testing-library/jest-native/extend-expect';

// Polyfills for Expo 54 + Jest environment issues 
if (typeof global.performance === 'undefined') {
  global.performance = { now: jest.fn() };
}
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class {
    constructor() { return {}; }
    getReader() { return {}; }
  };
}

// 1. Mocking @reactvision/react-viro 2.54.0
// This prevents tests from crashing when they encounter native Viro components
jest.mock('@reactvision/react-viro', () => {
  const React = require('react');
  return {
    ViroARScene: ({ children }: any) => React.createElement('ViroARScene', null, children),
    ViroARSceneNavigator: ({ children }: any) => React.createElement('ViroARSceneNavigator', null, children),
    requestRequiredPermissions: jest.fn(() => Promise.resolve(true)),
    ViroNode: ({ children }: any) => React.createElement('ViroNode', null, children),
    ViroARPlaneSelector: ({ children }: any) => React.createElement('ViroARPlaneSelector', null, children),
    ViroBox: (props: any) => React.createElement('ViroBox', props),
    ViroMaterials: {
      createMaterials: jest.fn(),
    },
    ViroAnimations: {
      registerAnimations: jest.fn(),
    },
    ViroFlexView: (props: any) => React.createElement('ViroFlexView', props),
    ViroText: (props: any) => React.createElement('ViroText', props),
    Viro3DObject: (props: any) => React.createElement('Viro3DObject', props),
    ViroDirectionalLight: (props: any) => React.createElement('ViroDirectionalLight', props),
    ViroTrackingStateConstants: {
      TRACKING_NORMAL: 1,
      TRACKING_REASON_NONE: 0,
    },
    ViroARImageMarker: ({ children }: any) => React.createElement('ViroARImageMarker', null, children),
  };
});

// 2. Mocking @rnmapbox/maps
jest.mock('@rnmapbox/maps', () => {
  const React = require('react');
  return {
    MapView: ({ children }: any) => React.createElement('MapView', null, children),
    Camera: () => React.createElement('Camera'),
    UserLocation: () => React.createElement('UserLocation'),
    PointAnnotation: ({ children }: any) => React.createElement('PointAnnotation', null, children),
    MarkerView: ({ children }: any) => React.createElement('MarkerView', null, children),
    ShapeSource: ({ children }: any) => React.createElement('ShapeSource', null, children),
    LineLayer: () => React.createElement('LineLayer'),
    setAccessToken: jest.fn(),
  };
});

// 3. Mocking Supabase Client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn((cb) => cb({ data: [], error: null })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

// 4. Mocking Expo Modules
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 34.198, longitude: 72.043 }
  })),
}));
