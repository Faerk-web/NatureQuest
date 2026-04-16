import React from 'react';
import {
  ViroARScene,
  ViroAnimatedComponent,
  ViroAnimations,
  ViroMaterials,
  ViroNode,
  ViroSphere,
  ViroSpatialSound,
  ViroText,
} from '@viro-community/react-viro';

export type ArAnchor = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export type TalkingTreeARSceneProps = {
  arAnchor?: ArAnchor;
  audioUrl?: string | null;
  isPlaying?: boolean;
  storyText?: string;
  onAudioFinished?: () => void;
  sceneNavigator?: {
    viroAppProps?: Partial<TalkingTreeARSceneProps>;
  };
};

const PulsingSphere = ViroAnimatedComponent(ViroSphere);

ViroAnimations.registerAnimations({
  pulseUp: {
    properties: {
      scaleX: 1.3,
      scaleY: 1.3,
      scaleZ: 1.3,
    },
    duration: 600,
    easing: 'EaseInEaseOut',
  },
  pulseDown: {
    properties: {
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    duration: 600,
    easing: 'EaseInEaseOut',
  },
  pulseSphere: {
    children: ['pulseUp', 'pulseDown'],
    easing: 'EaseInEaseOut',
  },
});

ViroMaterials.registerMaterials({
  treePulse: {
    diffuseColor: '#44ff88',
    lightingModel: 'Constant',
    writesToDepthBuffer: true,
    readsFromDepthBuffer: true,
  },
});

const defaultAnchor: ArAnchor = {
  position: [0, -0.4, -1.5],
  rotation: [0, 0, 0],
};

/** Renders the AR tree anchor with pulsing orb, directional speech and story overlay. */
export const TalkingTreeARScene: React.FC<TalkingTreeARSceneProps> = props => {
  const appProps = props.sceneNavigator?.viroAppProps ?? {};
  const arAnchor = appProps.arAnchor ?? props.arAnchor ?? defaultAnchor;
  const audioUrl = appProps.audioUrl ?? props.audioUrl ?? null;
  const isPlaying = appProps.isPlaying ?? props.isPlaying ?? false;
  const storyText = appProps.storyText ?? props.storyText ?? '';
  const onAudioFinished = appProps.onAudioFinished ?? props.onAudioFinished;

  return (
    <ViroARScene>
      <ViroNode position={arAnchor.position} rotation={arAnchor.rotation}>
        <PulsingSphere
          radius={0.08}
          materials={['treePulse']}
          animation={{ name: 'pulseSphere', run: true, loop: true }}
          scale={[1, 1, 1]}
        />

        {audioUrl ? (
          <ViroSpatialSound
            source={{ uri: audioUrl }}
            paused={!isPlaying}
            position={[0, 0, 0]}
            minDistance={0.5}
            maxDistance={8}
            rolloffModel="linear"
            volume={1.0}
            onFinish={onAudioFinished}
          />
        ) : null}

        {isPlaying && storyText ? (
          <ViroText
            text={storyText}
            position={[0, 0.18, 0]}
            width={2}
            height={2}
            style={{
              fontFamily: 'Arial',
              fontSize: 22,
              color: '#ffffff',
              textAlign: 'center',
              textAlignVertical: 'center',
            }}
          />
        ) : null}
      </ViroNode>
    </ViroARScene>
  );
};

export default TalkingTreeARScene;
