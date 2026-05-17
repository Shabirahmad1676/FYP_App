import React from 'react';
import {
  ViroARScene,
  ViroTrackingStateConstants,
  ViroARImageMarker,
  ViroNode,
  ViroText,
  ViroAmbientLight,
  ViroAnimations,
} from '@reactvision/react-viro';

ViroAnimations.registerAnimations({
  pulse: {
    properties: { opacity: 0.3 },
    easing: 'EaseInEaseOut',
    duration: 900,
  },
});

const ARScene = (props: any) => {
  const { onDetected, onLost, targetId, isPaused } = props.sceneNavigator.viroAppProps;
  const lastStateRef = React.useRef<number | null>(null);
  const hasActiveAnchorRef = React.useRef(false);

  React.useEffect(() => {
    console.log('[ARScene] mounted with targetId:', targetId);
    return () => {
      console.log('[ARScene] unmounted');
    };
  }, [targetId]);

  const onTrackingUpdated = (state: number, reason: any) => {
    if (lastStateRef.current === state) return;
    lastStateRef.current = state;

    const NORMAL = ViroTrackingStateConstants.TRACKING_NORMAL;
    const UNAVAILABLE = ViroTrackingStateConstants.TRACKING_UNAVAILABLE;

    if (state === NORMAL) {
      console.log('[ARScene] tracking: NORMAL');
    } else if (state === UNAVAILABLE) {
      console.log('[ARScene] tracking: UNAVAILABLE, reason:', reason);
      if (hasActiveAnchorRef.current) {
        hasActiveAnchorRef.current = false;
        onLost();
      }
    } else {
      console.log('[ARScene] tracking: LIMITED, state:', state);
    }
  };

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      <ViroAmbientLight color="#ffffff" intensity={300} />

      {targetId && !isPaused && (
        <ViroARImageMarker
          target={targetId}
          onAnchorFound={() => {
            if (hasActiveAnchorRef.current) {
              return;
            }

            hasActiveAnchorRef.current = true;
            console.log('[ARScene] anchor found:', targetId);
            const billboardId = targetId.replace('target_', '');
            onDetected(billboardId);
          }}
          onAnchorRemoved={() => {
            if (!hasActiveAnchorRef.current) {
              return;
            }

            hasActiveAnchorRef.current = false;
            console.log('[ARScene] anchor removed:', targetId);
            onLost();
          }}
        >
          <ViroNode position={[0, 0, 0.02]}>
            <ViroText
              text="TAP FOR OFFER"
              position={[0, 0.1, 0]}
              style={{
                fontFamily: 'Arial',
                fontSize: 24,
                color: '#00C851',
                fontWeight: '800',
                textAlign: 'center',
              }}
              width={1.2}
              height={0.2}
              animation={{
                name: 'pulse',
                run: true,
                loop: true,
              }}
            />
          </ViroNode>
        </ViroARImageMarker>
      )}
    </ViroARScene>
  );
};

export default ARScene;
