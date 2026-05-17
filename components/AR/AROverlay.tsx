import React from 'react';
import { StyleSheet } from 'react-native';
import {
  ViroFlexView,
  ViroText,
  ViroNode,
  ViroAnimations,
  Viro3DObject,
  ViroBox,
  ViroAmbientLight,
  ViroDirectionalLight,
} from '@reactvision/react-viro';

import { logEvent } from '@/lib/analytics';

// FIX: Register animations BEFORE component that uses them
ViroAnimations.registerAnimations({
  showOverlay: {
    properties: {
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      opacity: 1,
      positionZ: 0.5,
    },
    easing: 'Bounce',
    duration: 600,
  },
  floatOverlay: {
    properties: {
      positionZ: 0.6,
    },
    easing: 'EaseInEaseOut',
    duration: 1200,
  },
  flyToWallet: {
    properties: {
      scaleX: 0,
      scaleY: 0,
      scaleZ: 0,
      opacity: 0,
      positionY: 2,
      positionX: 1,
    },
    easing: 'EaseIn',
    duration: 800,
  },
  rotateGLB: {
    properties: {
      rotateY: '+=360',
    },
    duration: 5000,
  },
});

interface AROverlayProps {
  billboardId: string;
  campaignId: string | null;
  businessName: string;
  offerText: string;
  glbUrl?: string; // New: optional GLB asset URL
  onPress: () => void;
}

const AROverlay: React.FC<AROverlayProps> = ({ 
  billboardId, 
  campaignId, 
  businessName, 
  offerText, 
  glbUrl, 
  onPress 
}) => {
  const [animState, setAnimState] = React.useState<'showing' | 'floating' | 'flying'>('showing');
  const [glbFailed, setGlbFailed] = React.useState(false);
  const hasLoggedGaze = React.useRef(false);
  const isGlbUrlValid = typeof glbUrl === 'string' && /^https?:\/\/.+\.glb(\?.*)?$/i.test(glbUrl.trim());

  const handleGaze = () => {
    if (!hasLoggedGaze.current) {
      hasLoggedGaze.current = true;
      logEvent('ar_view_3s', billboardId, campaignId);
    }
  };

  const handleTap = () => {
    logEvent('tap', billboardId, campaignId);
    setAnimState('flying');
    setTimeout(onPress, 800);
  };

  return (
    <ViroNode
      position={[0, 0, 0]}
      scale={[0.1, 0.1, 0.1]}
      onFuse={{ callback: handleGaze, timeToFuse: 3000 }}
      // rotation={[-90, 0, 0]} 
      rotation={[0,0,0]}
      animation={{ 
        name: animState === 'showing' ? 'showOverlay' : animState === 'floating' ? 'floatOverlay' : 'flyToWallet', 
        run: true,
        loop: animState === 'floating',
        onFinish: () => {
          if (animState === 'showing') setAnimState('floating');
        }
      }}
    >
      <ViroAmbientLight color="#ffffff" intensity={200} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.2]} />

      {/* GLB rendering is temporarily disabled; keep the 2D card active for now. */}
      {/*
      {isGlbUrlValid && !glbFailed && (
        <ViroNode position={[0, 0, 0]} animation={{ name: 'rotateGLB', run: true, loop: true }}>
          <Viro3DObject
            source={{ uri: glbUrl!.trim() }}
            type="GLB"
            scale={[1, 1, 1]}
            position={[0, 0.5, 0]}
            rotation={[0, 0, 0]}
            onError={(error: unknown) => {
              console.warn('AROverlay GLB load failed', error);
              setGlbFailed(true);
            }}
          />
        </ViroNode>
      )}
      */}

      {/* 2D CONTENT: Styled Claim Card */}
      <ViroFlexView
        style={styles.card}
        width={3}
        height={1.8}
        position={[0, -0.8, 0.2]} // Positioned below/beside the 3D object
        onClick={handleTap}
      >

        {/* Temporary preview badge; not part of the current design. */}
        <ViroFlexView style={styles.badge} width={1} height={0.3} position={[0.9, 0.6, 0.01]}>
          <ViroText text="🔥 POPULAR" style={styles.badgeText} />
        </ViroFlexView>

        <ViroText
          text={businessName}
          style={styles.businessName}
          width={2.8}
          height={0.4}
        />
        <ViroText
          text={offerText}
          style={styles.offerText}
          width={2.8}
          height={0.8}
        />
        <ViroFlexView style={styles.rewardContainer} width={2.8} height={0.3}>
          <ViroText
            text="Tap to Claim Reward"
            style={styles.tapHint}
          />
        </ViroFlexView>
      </ViroFlexView>
      {/* Invisible box keeps the full card area tappable without affecting layout. */}
      <ViroBox
        scale={[3, 1.8, 0.01]}
        position={[0, -0.8, 0.19]}
        opacity={0}
        onClick={handleTap}
      />
    </ViroNode>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    flexDirection: 'column',
    padding: 0.2,
    borderRadius: 0.15,
    borderWidth: 0.02,
    borderColor: '#FFFFFF33',
  },
  badge: {
    backgroundColor: '#FF4444',
    borderRadius: 0.05,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
  },
  businessName: {
    fontFamily: 'Arial',
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  offerText: {
    fontFamily: 'Arial',
    fontSize: 20,
    color: '#FFFFFFBB',
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0.1,
  },
  tapHint: {
    fontFamily: 'Arial',
    fontSize: 16,
    color: '#00C851',
    fontWeight: 'bold',
  },
});

export default AROverlay;
