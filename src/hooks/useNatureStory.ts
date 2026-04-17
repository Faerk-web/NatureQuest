import { useCallback, useState } from 'react';

export type NatureStoryStatus = 'idle' | 'loading' | 'success' | 'error';

export type NatureStoryResult = {
  treeSpecies: string;
  storyText: string;
  audioUrl: string;
  voiceId: string;
};

/** Maps common Danish tree species names to ElevenLabs voice IDs. */
export const voiceMap: Record<string, string> = {
  egetræ: 'voice_deep_oak_placeholder',
  eg: 'voice_deep_oak_placeholder',
  oak: 'voice_deep_oak_placeholder',
  birk: 'voice_light_birch_placeholder',
  birketræ: 'voice_light_birch_placeholder',
  birch: 'voice_light_birch_placeholder',
  bøg: 'voice_warm_beech_placeholder',
  bøgetræ: 'voice_warm_beech_placeholder',
  fyr: 'voice_rugged_pine_placeholder',
  fyrretræ: 'voice_rugged_pine_placeholder',
  gran: 'voice_calm_spruce_placeholder',
  grantræ: 'voice_calm_spruce_placeholder',
  ahorn: 'voice_friendly_maple_placeholder',
  piletræ: 'voice_soft_willow_placeholder',
  pil: 'voice_soft_willow_placeholder',
};

const DEFAULT_VOICE_ID = 'voice_default_tree_placeholder';
const MAX_CACHED_AUDIO_FILES = 3;
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

const readEnv = (key: string): string | undefined => {
  try {
    const reactNativeConfig = require('react-native-config')?.default;
    if (reactNativeConfig?.[key]) {
      return reactNativeConfig[key] as string;
    }
  } catch (_error) {}

  try {
    const constants = require('expo-constants')?.default;
    const expoExtra = constants?.expoConfig?.extra ?? constants?.manifest?.extra;
    if (expoExtra?.[key]) {
      return expoExtra[key] as string;
    }
  } catch (_error) {}

  return undefined;
};

const normalizeSpecies = (value: string): string => value.trim().toLowerCase();

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return globalThis.btoa(binary);
  }

  const bufferPolyfill = require('buffer').Buffer;
  return bufferPolyfill.from(bytes).toString('base64');
};

const pickVoiceId = (treeSpecies: string): string => {
  return voiceMap[normalizeSpecies(treeSpecies)] ?? DEFAULT_VOICE_ID;
};

const sanitizeTreeSpecies = (value: string): string => {
  const cleaned = value.replace(/[^a-zA-ZæøåÆØÅ\s-]/g, '').trim();
  return cleaned || value.trim();
};

const extractTimestamp = (fileName: string): number => {
  const match = fileName.match(/nature-story-(\d+)\.mp3$/);
  return match ? Number(match[1]) : 0;
};

const toUserFacingError = (error: unknown): Error => {
  if (error instanceof TypeError) {
    return new Error('Netværksfejl: Tjek internetforbindelsen og prøv igen.');
  }

  return error instanceof Error ? error : new Error('Der opstod en ukendt fejl.');
};

const parseFirstMessage = (payload: unknown): string => {
  const content = (payload as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Ugyldigt svar fra AI-tjenesten.');
  }

  return content.trim();
};

const requireEnv = (key: 'OPENAI_API_KEY' | 'ELEVENLABS_API_KEY'): string => {
  const value = readEnv(key);
  if (!value) {
    throw new Error(`Manglende miljøvariabel: ${key}`);
  }

  return value;
};

const identifySpecies = async (imageBase64: string, openAiApiKey: string): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identificér træets art. Svar kun med artsnavn på dansk.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 30,
    }),
  });

  if (!response.ok) {
    throw new Error('Kunne ikke identificere træet.');
  }

  const payload = await response.json();
  return parseFirstMessage(payload);
};

const generateStory = async (treeSpecies: string, openAiApiKey: string): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du er et ${treeSpecies}-træ og taler direkte til et 9-årigt barn på dansk. Skriv 3-4 sætninger i første person. Vær sjov og venlig.`,
        },
        {
          role: 'user',
          content: 'Fortæl din historie nu.',
        },
      ],
      max_tokens: 240,
    }),
  });

  if (!response.ok) {
    throw new Error('Kunne ikke generere historie.');
  }

  const payload = await response.json();
  return parseFirstMessage(payload);
};

const saveAudioToLocalFile = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const FileSystem = require('expo-file-system');
    const cacheDirectory: string = FileSystem.cacheDirectory;
    const fileName = `nature-story-${Date.now()}.mp3`;
    const uri = `${cacheDirectory}${fileName}`;
    const base64Audio = arrayBufferToBase64(arrayBuffer);
    await FileSystem.writeAsStringAsync(uri, base64Audio, { encoding: FileSystem.EncodingType.Base64 });
    const cachedFiles: string[] = await FileSystem.readDirectoryAsync(cacheDirectory);
    const historicalAudioFiles = cachedFiles
      .filter(name => name.startsWith('nature-story-') && name.endsWith('.mp3'))
      .sort((left, right) => extractTimestamp(left) - extractTimestamp(right));

    if (historicalAudioFiles.length > MAX_CACHED_AUDIO_FILES) {
      const filesToDelete = historicalAudioFiles.slice(0, historicalAudioFiles.length - MAX_CACHED_AUDIO_FILES);
      await Promise.all(
        filesToDelete.map(file => FileSystem.deleteAsync(`${cacheDirectory}${file}`, { idempotent: true })),
      );
    }

    return uri;
  } catch (_error) {
    throw new Error('Lokal lydlagring kræver expo-file-system i projektet.');
  }
};

const synthesizeSpeech = async (storyText: string, voiceId: string, elevenLabsApiKey: string): Promise<string> => {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: storyText,
      model_id: ELEVENLABS_MODEL_ID,
    }),
  });

  if (!response.ok) {
    throw new Error('Kunne ikke generere tale.');
  }

  const audioBuffer = await response.arrayBuffer();
  return saveAudioToLocalFile(audioBuffer);
};

/**
 * Runs the full tree identification, story generation, and speech synthesis pipeline.
 */
export const useNatureStory = () => {
  const [status, setStatus] = useState<NatureStoryStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (imageBase64: string): Promise<NatureStoryResult> => {
    setStatus('loading');
    setError(null);

    try {
      const openAiApiKey = requireEnv('OPENAI_API_KEY');
      const elevenLabsApiKey = requireEnv('ELEVENLABS_API_KEY');

      const identifiedSpecies = await identifySpecies(imageBase64, openAiApiKey);
      const treeSpecies = sanitizeTreeSpecies(identifiedSpecies);
      const storyText = await generateStory(treeSpecies, openAiApiKey);
      const voiceId = pickVoiceId(treeSpecies);
      const audioUrl = await synthesizeSpeech(storyText, voiceId, elevenLabsApiKey);

      const result: NatureStoryResult = { treeSpecies, storyText, audioUrl, voiceId };
      setStatus('success');
      return result;
    } catch (caughtError) {
      const userFacingError = toUserFacingError(caughtError);
      setError(userFacingError.message);
      setStatus('error');
      throw userFacingError;
    }
  }, []);

  return { run, status, error };
};

export default useNatureStory;
