import React, { useRef, useState } from 'react';
import {
  ViroARScene,
  ViroARPlaneSelector,
  ViroBox,
  ViroMaterials,
  ViroTrackingStateConstants,
  Viro3DObject,
  ViroNode,
  ViroAmbientLight,
} from '@reactvision/react-viro';
import * as Haptics from 'expo-haptics';

interface AdminARSceneProps {
  sceneNavigator: {
    viroAppProps: {
      isHosting: boolean;
      onAnchorHosted: (anchorId: string) => void;
      setScanStatus: (status: 'idle' | 'scanning' | 'hosting' | 'success') => void;
      onTrackingUpdated: (state: any) => void;
      glbUrl?: string;
      physicalWidth: number;
    }
    hostCloudAnchor: (anchorId: string, ttl: number) => Promise<{ success: boolean; cloudAnchorId?: string; error?: string }>;
  }
}

const AdminARScene = (props: AdminARSceneProps) => {
  const { 
    isHosting, 
    onAnchorHosted, 
    setScanStatus, 
    onTrackingUpdated, 
    glbUrl, 
    physicalWidth 
  } = props.sceneNavigator.viroAppProps;
  
  const selectorRef = useRef<any>(null);

  const handlePlaneSelected = async (anchor: any) => {
    if (!isHosting) return;
    
    setScanStatus('hosting');
    try {
      const result = await props.sceneNavigator.hostCloudAnchor(anchor.anchorId, 365);
      
      if (result.success && result.cloudAnchorId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAnchorHosted(result.cloudAnchorId);
      } else {
        console.error("Failed to host:", result.error);
        setScanStatus('idle');
      }
    } catch (error) {
      console.error("Hosting error:", error);
      setScanStatus('idle');
    }
  };

  return (
    <ViroARScene 
      anchorDetectionTypes={["PlanesVertical"]} 
      onAnchorFound={(a) => selectorRef.current?.handleAnchorFound(a)}
      onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(a)}
      onAnchorRemoved={(a) => a && selectorRef.current?.handleAnchorRemoved(a)}
      onTrackingUpdated={(state) => onTrackingUpdated(state)}
    >
      <ViroAmbientLight color="#ffffff" intensity={1000} />
      
      <ViroARPlaneSelector 
        ref={selectorRef}
        onPlaneSelected={handlePlaneSelected}
      >
        <ViroNode
          scale={[physicalWidth, physicalWidth, physicalWidth]}
        >
          {/* Visual Indicator of the anchor point */}
          <ViroBox 
            scale={[0.5, 0.5, 0.05]} 
            materials={["ghost"]} 
          />

          {/* Ghost 3D Model Alignment */}
          {glbUrl && (
            <Viro3DObject
              source={{ uri: glbUrl }}
              type="GLB"
              position={[0, 0, 0]}
              scale={[1, 1, 1]}
              materials={["ghost"]}
            />
          )}
        </ViroNode>
      </ViroARPlaneSelector>
    </ViroARScene>
  );
};

ViroMaterials.createMaterials({
  ghost: {
    diffuseColor: 'rgba(0, 200, 81, 0.3)', // Translucent success green
    lightingModel: 'PBR',
  },
});

export default AdminARScene;
