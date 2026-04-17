import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ViroARSceneNavigator } from '@reactvision/react-viro';

import { TalkingTreeARScene } from '../components/TalkingTreeARScene';
import { useNatureStory } from '../hooks/useNatureStory';
import type { ARAnchor, UIState } from '../types/talkingTree';

const INITIAL_ANCHOR: ARAnchor = {
  position: [0, -0.2, -1],
  rotation: [0, 0, 0],
};

const uiStateLabels: Record<UIState, string> = {
  idle: 'Klar til at tage billede af et træ',
  capturing: 'Tager billede...',
  loading: 'Træet tænker over sin historie...',
  speaking: 'Træet fortæller!',
  error: 'Ups! Noget gik galt.',
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');

      if (!base64) {
        reject(new Error('Kunne ikke konvertere billedet.'));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => reject(new Error('Kunne ikke læse billedet.'));
    reader.readAsDataURL(blob);
  });
};

const normalizeScreenshotToBase64 = async (captureResult: unknown): Promise<string> => {
  if (typeof captureResult === 'string' && captureResult.startsWith('data:image')) {
    const [, base64 = ''] = captureResult.split(',');

    if (!base64) {
      throw new Error('Ugyldigt skærmbillede fra AR-kameraet.');
    }

    return base64;
  }

  if (typeof captureResult === 'string') {
    const response = await fetch(captureResult);
    const blob = await response.blob();

    return blobToBase64(blob);
  }

  if (
    typeof captureResult === 'object' &&
    captureResult !== null &&
    'base64' in captureResult &&
    typeof (captureResult as { base64?: unknown }).base64 === 'string'
  ) {
    return (captureResult as { base64: string }).base64;
  }

  throw new Error('AR-kameraet returnerede ikke et billede.');
};

/**
 * Talking Tree-screen med AR-visning, capture-knap og fuldt fortælleflow.
 */
const TalkingTreeScreen: React.FC = () => {
  const arNavigatorRef = useRef<unknown>(null);
  const { run, error: hookError } = useNatureStory();

  const [uiState, setUiState] = useState<UIState>('idle');
  const [arAnchor, setArAnchor] = useState<ARAnchor | null>(INITIAL_ANCHOR);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canCapture = uiState === 'idle' || uiState === 'error';
  const isPlaying = uiState === 'speaking';
  const captureButtonText = canCapture ? 'Tag træ-billede' : 'Arbejder...';

  const activeError = errorMessage ?? hookError;

  const statusText = useMemo(() => {
    if (uiState === 'error' && activeError) {
      return `Fejl: ${activeError}`;
    }

    return uiStateLabels[uiState];
  }, [activeError, uiState]);

  const captureFrameBase64 = useCallback(async (): Promise<string> => {
    const navigator = arNavigatorRef.current as {
      takeScreenshot?: (fileName: string, saveToCameraRoll: boolean) => Promise<unknown>;
    };

    if (!navigator?.takeScreenshot) {
      throw new Error('AR-kamera capture er ikke tilgængelig på denne enhed.');
    }

    const captureResult = await navigator.takeScreenshot(`tree-${Date.now()}.jpg`, false);

    return normalizeScreenshotToBase64(captureResult);
  }, []);

  const onCapturePress = useCallback(async () => {
    setErrorMessage(null);

    try {
      setUiState('capturing');
      const imageBase64 = await captureFrameBase64();

      setUiState('loading');
      const storyResult = await run(imageBase64);

      setArAnchor((previous) => previous ?? INITIAL_ANCHOR);
      setAudioUrl(storyResult.audioUrl);
      setStoryText(storyResult.storyText);
      setUiState('speaking');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Der opstod en ukendt fejl under talking tree-flowet.';

      setErrorMessage(message);
      setUiState('error');
      Alert.alert('Talking Tree', message);
    }
  }, [captureFrameBase64, run]);

  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        ref={arNavigatorRef}
        autofocus
        style={styles.arView}
        initialScene={{ scene: TalkingTreeARScene }}
        viroAppProps={{
          arAnchor,
          audioUrl,
          isPlaying,
          storyText,
        }}
      />

      <View style={styles.overlayTop}>
        <Text style={styles.statusText}>{statusText}</Text>
        {uiState === 'capturing' || uiState === 'loading' ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : null}
      </View>

      <View style={styles.overlayBottom}>
        <Pressable
          style={[styles.captureButton, !canCapture && styles.captureButtonDisabled]}
          onPress={onCapturePress}
          disabled={!canCapture}
        >
          <Text style={styles.captureButtonText}>{captureButtonText}</Text>
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
  arView: {
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  overlayBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  captureButton: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#34C759',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default TalkingTreeScreen;
