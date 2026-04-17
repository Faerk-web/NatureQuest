import { useCallback, useState } from 'react';

import { defaultVoiceId, voiceMap } from '../config/voiceMap';
import type { NatureStoryResult } from '../types/talkingTree';

type HookStatus = 'idle' | 'loading' | 'error';

type OpenAICompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const ELEVENLABS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

const tryReadConfigValue = (name: string): string | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const configModule = require('react-native-config');
    const config = configModule?.default ?? configModule;

    if (config?.[name]) {
      return config[name] as string;
    }
  } catch {
    // Optional dependency.
  }

  return undefined;
};

const tryReadExpoExtra = (name: string): string | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const constantsModule = require('expo-constants');
    const constants = constantsModule?.default ?? constantsModule;
    const extra =
      constants?.expoConfig?.extra ?? constants?.manifest2?.extra ?? constants?.manifest?.extra;

    if (extra?.[name]) {
      return extra[name] as string;
    }
  } catch {
    // Optional dependency.
  }

  return undefined;
};

const getEnvValue = (name: string): string | undefined => {
  return process.env[name] ?? tryReadConfigValue(name) ?? tryReadExpoExtra(name);
};

const getContent = (response: OpenAICompletionResponse, fallback: string): string => {
  const content = response.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error(fallback);
  }

  return content;
};

const sanitizeSpeciesForPrompt = (treeSpecies: string): string => {
  const sanitized = treeSpecies
    .toLowerCase()
    .replace(/[^a-zæøå\s-]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

  return sanitized || 'ukendt';
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');

      if (!base64) {
        reject(new Error('Kunne ikke konvertere lydfilen.'));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => reject(new Error('Kunne ikke læse lydfilen.'));
    reader.readAsDataURL(blob);
  });
};

const saveAudioLocally = async (base64Audio: string): Promise<string> => {
  const fileName = `talking-tree-${Date.now()}.mp3`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const expoFileSystem = require('expo-file-system');

    if (expoFileSystem?.cacheDirectory && expoFileSystem?.writeAsStringAsync) {
      const uri = `${expoFileSystem.cacheDirectory}${fileName}`;
      const encoding = expoFileSystem?.EncodingType?.Base64 ?? 'base64';
      await expoFileSystem.writeAsStringAsync(uri, base64Audio, { encoding });

      return uri;
    }
  } catch {
    // Optional dependency.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const rnfsModule = require('react-native-fs');
    const rnfs = rnfsModule?.default ?? rnfsModule;

    if (rnfs?.CachesDirectoryPath && rnfs?.writeFile) {
      const path = `${rnfs.CachesDirectoryPath}/${fileName}`;
      await rnfs.writeFile(path, base64Audio, 'base64');

      return `file://${path}`;
    }
  } catch {
    // Optional dependency.
  }

  return `data:audio/mpeg;base64,${base64Audio}`;
};

const selectVoiceId = (speciesRaw: string): string => {
  const species = speciesRaw.trim().toLowerCase();

  if (voiceMap[species]) {
    return voiceMap[species];
  }

  const partialMatch = Object.keys(voiceMap).find((name) => species.includes(name));

  return partialMatch ? voiceMap[partialMatch] : defaultVoiceId;
};

const identifyTreeSpecies = async (imageBase64: string, openAiKey: string): Promise<string> => {
  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identificér træarten. Svar kun med navnet på træarten på dansk.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 30,
    }),
  });

  if (!response.ok) {
    throw new Error('Kunne ikke identificere træarten fra billedet.');
  }

  const data = (await response.json()) as OpenAICompletionResponse;

  return getContent(data, 'Træarten kunne ikke bestemmes.');
};

const generateStory = async (treeSpecies: string, openAiKey: string): Promise<string> => {
  const safeSpecies = sanitizeSpeciesForPrompt(treeSpecies);

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du er et ${safeSpecies}-træ og taler direkte til et 9-årigt barn på dansk. Skriv 3-4 sætninger i første person. Vær sjov og venlig.`,
        },
        {
          role: 'user',
          content: 'Fortæl din lille naturhistorie nu.',
        },
      ],
      temperature: 0.8,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    throw new Error('Kunne ikke lave træets historie.');
  }

  const data = (await response.json()) as OpenAICompletionResponse;

  return getContent(data, 'Historien kunne ikke genereres.');
};

const generateSpeech = async (
  storyText: string,
  voiceId: string,
  elevenLabsKey: string,
): Promise<string> => {
  const response = await fetch(`${ELEVENLABS_ENDPOINT}/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
      'xi-api-key': elevenLabsKey,
    },
    body: JSON.stringify({
      text: storyText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Kunne ikke lave lyd fra historien.');
  }

  const audioBlob = await response.blob();
  const base64Audio = await blobToBase64(audioBlob);

  return saveAudioLocally(base64Audio);
};

/**
 * Kører hele Talking Tree-kæden: artsgenkendelse, historie og tale.
 */
export const useNatureStory = () => {
  const [status, setStatus] = useState<HookStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (imageBase64: string): Promise<NatureStoryResult> => {
    const openAiKey = getEnvValue('OPENAI_API_KEY');
    const elevenLabsKey = getEnvValue('ELEVENLABS_API_KEY');

    if (!openAiKey || !elevenLabsKey) {
      const message = 'Mangler API-nøgler. Tjek OPENAI_API_KEY og ELEVENLABS_API_KEY.';
      setStatus('error');
      setError(message);
      throw new Error(message);
    }

    setStatus('loading');
    setError(null);

    try {
      const treeSpecies = await identifyTreeSpecies(imageBase64, openAiKey);
      const storyText = await generateStory(treeSpecies, openAiKey);
      const voiceId = selectVoiceId(treeSpecies);
      const audioUrl = await generateSpeech(storyText, voiceId, elevenLabsKey);

      setStatus('idle');

      return {
        treeSpecies,
        storyText,
        audioUrl,
        voiceId,
      };
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : 'Ukendt fejl opstod.';

      setStatus('error');
      setError(message);
      throw new Error(message);
    }
  }, []);

  return {
    run,
    status,
    error,
  };
};
