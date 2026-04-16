import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ViroARSceneNavigator } from '@viro-community/react-viro';
import TalkingTreeARScene, { ArAnchor } from '../scenes/TalkingTreeARScene';
import { useNatureStory } from '../hooks/useNatureStory';

type TalkingTreeScreenState = 'idle' | 'capturing' | 'loading' | 'speaking' | 'error';

type TalkingTreeScreenProps = {
  captureImageBase64?: () => Promise<string>;
};

const initialAnchor: ArAnchor = {
  position: [0, -0.4, -1.5],
  rotation: [0, 0, 0],
};

/**
 * Hosts the Talking Tree AR experience, capture action, and end-to-end storytelling state machine.
 */
export const TalkingTreeScreen: React.FC<TalkingTreeScreenProps> = ({ captureImageBase64 }) => {
  const [screenState, setScreenState] = useState<TalkingTreeScreenState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { run, status: storyStatus, error: storyError } = useNatureStory();

  const handleCapturePress = async () => {
    setErrorMessage(null);

    try {
      setScreenState('capturing');
      if (!captureImageBase64) {
        throw new Error('Kamera-capture er ikke konfigureret endnu.');
      }

      const imageBase64 = await captureImageBase64();
      setScreenState('loading');
      const result = await run(imageBase64);
      setStoryText(result.storyText);
      setAudioUrl(result.audioUrl);
      setIsPlaying(true);
      setScreenState('speaking');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Der opstod en ukendt fejl.';
      setErrorMessage(message);
      setIsPlaying(false);
      setScreenState('error');
    }
  };

  const handleAudioFinished = () => {
    setIsPlaying(false);
    setScreenState('idle');
  };

  const statusLabel = useMemo(() => {
    if (screenState === 'error') {
      return errorMessage ?? storyError ?? 'Noget gik galt.';
    }

    if (screenState === 'capturing') {
      return 'Tager billede...';
    }

    if (screenState === 'loading' || storyStatus === 'loading') {
      return 'Træet tænker...';
    }

    if (screenState === 'speaking') {
      return 'Træet fortæller...';
    }

    return 'Peg kameraet mod et træ';
  }, [errorMessage, screenState, storyError, storyStatus]);

  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        autofocus
        style={styles.arScene}
        initialScene={{ scene: TalkingTreeARScene }}
        viroAppProps={{
          arAnchor: initialAnchor,
          audioUrl,
          isPlaying,
          storyText,
          onAudioFinished: handleAudioFinished,
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>

        <Pressable
          onPress={handleCapturePress}
          style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
          disabled={screenState === 'capturing' || screenState === 'loading' || storyStatus === 'loading'}
        >
          <Text style={styles.captureButtonText}>Tag billede</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  arScene: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 40,
  },
  statusPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  captureButton: {
    backgroundColor: '#39a845',
    borderRadius: 999,
    minWidth: 148,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  captureButtonPressed: {
    opacity: 0.8,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default TalkingTreeScreen;
