import { createAudioPlayer } from 'expo-audio';

export function playOnce(uri: string) {
  const player = createAudioPlayer(uri);
  player.play();
  return player;
}
