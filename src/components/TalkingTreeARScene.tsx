import React, { useMemo } from 'react';
import {
  ViroARScene,
  ViroAnimatedComponent,
  ViroAnimations,
  ViroMaterials,
  ViroNode,
  ViroSpatialSound,
  ViroSphere,
  ViroText,
} from '@reactvision/react-viro';

import type { TalkingTreeARSceneProps } from '../types/talkingTree';

type SceneNavigatorProps = {
  sceneNavigator?: {
    viroAppProps?: TalkingTreeARSceneProps;
  };
};

const AnimatedSphere = ViroAnimatedComponent(ViroSphere);

ViroAnimations.registerAnimations({
  pulse: [{
    properties: {
      scaleX: 1.3,
      scaleY: 1.3,
      scaleZ: 1.3,
    },
    duration: 600,
    easing: 'EaseInEaseOut',
  }, {
    properties: {
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    duration: 600,
    easing: 'EaseInEaseOut',
  }],
  pulseLoop: {
    children: ['pulse'],
    loop: true,
  },
});

/**
 * AR-scene der viser træets talepunkt, afspiller spatial lyd og tekst.
 */
export const TalkingTreeARScene: React.FC<SceneNavigatorProps | TalkingTreeARSceneProps> = (props) => {
  const appProps = (props as SceneNavigatorProps)?.sceneNavigator?.viroAppProps;
  const resolvedProps = useMemo<TalkingTreeARSceneProps>(() => {
    if (appProps) {
      return appProps;
    }

    const directProps = props as TalkingTreeARSceneProps;

    return {
      arAnchor: directProps.arAnchor ?? null,
      audioUrl: directProps.audioUrl ?? null,
      isPlaying: Boolean(directProps.isPlaying),
      storyText: directProps.storyText ?? '',
    };
  }, [appProps, props]);

  const { arAnchor, audioUrl, isPlaying, storyText } = resolvedProps;

  return (
    <ViroARScene>
      {arAnchor ? (
        <ViroNode position={arAnchor.position} rotation={arAnchor.rotation}>
          <AnimatedSphere
            radius={0.08}
            materials={['talkingTreeSphere']}
            animation={{ name: 'pulseLoop', run: true, loop: true }}
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
            />
          ) : null}

          {isPlaying && storyText ? (
            <ViroText
              text={storyText}
              width={2.2}
              height={1.2}
              position={[0, 0.25, 0]}
              style={{
                fontSize: 22,
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            />
          ) : null}
        </ViroNode>
      ) : null}
    </ViroARScene>
  );
};

ViroMaterials.registerMaterials({
  talkingTreeSphere: {
    diffuseColor: '#39D353',
    emissiveColor: '#39D353',
  },
});
