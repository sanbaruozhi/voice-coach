import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionDraft } from '../types';

const KEY = 'voice-coach:session-draft';

export async function saveSessionDraft(draft: SessionDraft) {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function readSessionDraft() {
  const value = await AsyncStorage.getItem(KEY);
  return value ? (JSON.parse(value) as SessionDraft) : null;
}

export async function updateSessionDraft(updates: Partial<SessionDraft>) {
  const draft = await readSessionDraft();
  if (!draft) return null;
  const next = { ...draft, ...updates };
  await saveSessionDraft(next);
  return next;
}

export async function clearSessionDraft() {
  await AsyncStorage.removeItem(KEY);
}
