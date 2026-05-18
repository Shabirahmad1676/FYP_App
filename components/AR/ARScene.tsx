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
  const { onDetected, onLost, targetId, targetIds, isPaused, onTrackingChange } = props.sceneNavigator.viroAppProps;
  const lastStateRef = React.useRef<number | null>(null);
  const hasActiveAnchorRef = React.useRef(false);
  // Merge single targetId and targetIds array into one list
  const allTargetIds: string[] = React.useMemo(() => {
    const ids = new Set<string>();
    if (targetId) ids.add(targetId);
    if (targetIds) targetIds.forEach((t: string) => ids.add(t));
    return Array.from(ids);
  }, [targetId, targetIds]);

  React.useEffect(() => {
    console.log('[ARScene] mounted with targetId:', targetId);
    return () => {
      console.log('[ARScene] unmounted');
    };
  }, [targetId]);

  // const onTrackingUpdated = (state: number, reason: any) => {
  //   if (lastStateRef.current === state) return;
  //   lastStateRef.current = state;

  //   const NORMAL = ViroTrackingStateConstants.TRACKING_NORMAL;
  //   const UNAVAILABLE = ViroTrackingStateConstants.TRACKING_UNAVAILABLE;

  //   if (state === NORMAL) {
  //     console.log('[ARScene] tracking: NORMAL');
  //   } else if (state === UNAVAILABLE) {
  //     console.log('[ARScene] tracking: UNAVAILABLE, reason:', reason);
  //     if (hasActiveAnchorRef.current) {
  //       hasActiveAnchorRef.current = false;
  //       onLost();
  //     }
  //   } else {
  //     console.log('[ARScene] tracking: LIMITED, state:', state);
  //   }
  // };


  // Inside ARScene.tsx
const onTrackingUpdated = (state: number, reason: any) => {
  if (lastStateRef.current === state) return;
  lastStateRef.current = state;

  const NORMAL = ViroTrackingStateConstants.TRACKING_NORMAL;
  const UNAVAILABLE = ViroTrackingStateConstants.TRACKING_UNAVAILABLE;
  const LIMITED = ViroTrackingStateConstants.TRACKING_LIMITED;

  if (state === NORMAL) {
    console.log('[DEBUG-AR] Tracking Engine Status: NORMAL (Camera matrix aligned)');
    console.log('[DEBUG-AR] Active Target list currently inside native memory:', allTargetIds);
    onTrackingChange?.('NORMAL');
  } else if (state === LIMITED) {
    console.log('[DEBUG-AR] Tracking Engine Status: LIMITED. Reason code:', reason);
    onTrackingChange?.(`LIMITED(${String(reason)})`);
    // Reason 1 = Searching for features, Reason 2 = Device moving too fast
  } else if (state === UNAVAILABLE) {
    console.log('[DEBUG-AR] Tracking Engine Status: UNAVAILABLE. Reason:', reason);
    onTrackingChange?.(`UNAVAILABLE(${String(reason)})`);
  }
};


  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      <ViroAmbientLight color="#ffffff" intensity={300} />

      {allTargetIds.length > 0 && !isPaused && allTargetIds.map((tid) => (
        <ViroARImageMarker
          key={tid}
          target={tid}
          onAnchorFound={() => {
            if (hasActiveAnchorRef.current) {
              return;
            }

            hasActiveAnchorRef.current = true;
            console.log('[ARScene] anchor found:', tid);
            const billboardId = tid.replace('target_', '');
            onDetected(billboardId);
          }}
          onAnchorRemoved={() => {
            if (!hasActiveAnchorRef.current) {
              return;
            }

            hasActiveAnchorRef.current = false;
            console.log('[ARScene] anchor removed:', tid);
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
      ))}
    </ViroARScene>
  );
};

export default ARScene;
