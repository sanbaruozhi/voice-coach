import * as FileSystem from 'expo-file-system/legacy';
import { createId } from '../utils/ids';

export async function persistRecording(tempUri: string) {
  const root = `${FileSystem.documentDirectory ?? ''}recordings`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true }).catch(() => undefined);
  const targetUri = `${root}/${createId('voice')}.m4a`;
  await FileSystem.copyAsync({ from: tempUri, to: targetUri });
  return targetUri;
}

export async function getLocalAudioMetrics(fileUri: string) {
  const info = await FileSystem.getInfoAsync(fileUri);
  return {
    exists: info.exists,
    size: info.exists && 'size' in info ? info.size ?? 0 : 0,
    isProbablyEmpty: !info.exists || !('size' in info) || (info.size ?? 0) < 1024,
  };
}
