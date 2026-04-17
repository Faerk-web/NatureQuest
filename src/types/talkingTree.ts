export type UIState = 'idle' | 'capturing' | 'loading' | 'speaking' | 'error';

export type Vector3 = [number, number, number];

export interface NatureStoryResult {
  treeSpecies: string;
  storyText: string;
  audioUrl: string;
  voiceId: string;
}

export interface ARAnchor {
  position: Vector3;
  rotation: Vector3;
}

export interface TalkingTreeARSceneProps {
  arAnchor: ARAnchor | null;
  audioUrl: string | null;
  isPlaying: boolean;
  storyText: string;
}
