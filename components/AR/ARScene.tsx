import React from 'react';
import {
  ViroARScene,
  ViroTrackingStateConstants,
  ViroARImageMarker,
} from '@reactvision/react-viro';

interface ARSceneProps {
  onDetected: (billboardId: string) => void;
  onLost: () => void;
  targetId: string | null;
}

const ARScene = (props: any) => {
  const { onDetected, onLost, targetId } = props.sceneNavigator.viroAppProps;

  const onTrackingUpdated = (state: any, reason: any) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      console.log('AR Tracking Normal ✅');
    } else if (state === ViroTrackingStateConstants.TRACKING_UNAVAILABLE) {
      console.log('AR Tracking Unavailable ❌');
      onLost();
    }
  };

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      {targetId && (
        <ViroARImageMarker
          target={targetId}
          onAnchorFound={() => {
            console.log('Anchor Found:', targetId);
            const billboardId = targetId.replace('target_', '');
            onDetected(billboardId);
          }}
          onAnchorRemoved={() => {
            console.log('Anchor Lost:', targetId);
            onLost();
          }}
        />
      )}
    </ViroARScene>
  );
};

export default ARScene;
