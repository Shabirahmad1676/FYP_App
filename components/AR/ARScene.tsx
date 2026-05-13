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
  const lastTrackingStateRef = React.useRef<string | null>(null);
  const hasActiveAnchorRef = React.useRef(false);
  const lastAnchorLogAtRef = React.useRef(0);
  const isTrackingNormal =
    ViroTrackingStateConstants.TRACKING_NORMAL !== undefined
      ? stateIsNormalFactory(ViroTrackingStateConstants.TRACKING_NORMAL)
      : (state: number) => state === 3;
  const isTrackingUnavailable =
    ViroTrackingStateConstants.TRACKING_UNAVAILABLE !== undefined
      ? stateIsUnavailableFactory(ViroTrackingStateConstants.TRACKING_UNAVAILABLE)
      : (state: number) => state === 1;

  React.useEffect(() => {
    console.log('[ARScene] mounted with targetId:', targetId);
    return () => {
      console.log('[ARScene] unmounted');
    };
  }, [targetId]);

  const onTrackingUpdated = (state: any, reason: any) => {
    const trackingLabel = isTrackingNormal(state)
      ? 'TRACKING_NORMAL'
      : isTrackingUnavailable(state)
        ? 'TRACKING_UNAVAILABLE'
        : `TRACKING_${String(state)}`;

    if (lastTrackingStateRef.current !== trackingLabel) {
      lastTrackingStateRef.current = trackingLabel;
      console.log('[ARScene] tracking update:', { state, reason, targetId, trackingLabel });
    }

    if (isTrackingNormal(state)) {
    } else if (isTrackingUnavailable(state)) {
      if (targetId && hasActiveAnchorRef.current) {
        hasActiveAnchorRef.current = false;
        onLost();
      }
    }
  };

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      {targetId && (
        <ViroARImageMarker
          target={targetId}
          onAnchorUpdated={(anchor: any) => {
            const now = Date.now();
            if (now - lastAnchorLogAtRef.current >= 2000) {
              lastAnchorLogAtRef.current = now;
              console.log('[ARScene] anchor updated snapshot:', {
                targetId,
                position: anchor?.position,
                rotation: anchor?.rotation,
              });
            }
          }}
          onAnchorFound={() => {
            if (hasActiveAnchorRef.current) {
              return;
            }

            hasActiveAnchorRef.current = true;
            console.log('[ARScene] anchor found for target:', targetId);
            const billboardId = targetId.replace('target_', '');
            onDetected(billboardId);
          }}
          onAnchorRemoved={() => {
            if (!hasActiveAnchorRef.current) {
              return;
            }

            hasActiveAnchorRef.current = false;
            console.log('[ARScene] anchor removed for target:', targetId);
            onLost();
          }}
        />
      )}
    </ViroARScene>
  );
};

function stateIsNormalFactory(normalValue: number) {
  return (state: number) => state === normalValue;
}

function stateIsUnavailableFactory(unavailableValue: number) {
  return (state: number) => state === unavailableValue;
}

export default ARScene;
