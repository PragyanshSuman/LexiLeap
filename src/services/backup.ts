import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { dayKey } from '@/lib/date';
import { useAppStore } from '@/store/appStore';
import { createBackupData, parseBackup } from '@/store/backupFormat';

/** Writes all children and progress to a JSON file and opens the share sheet (save to Files, Drive, email…). */
export async function shareBackup(): Promise<void> {
  const { profiles, progress } = useAppStore.getState();
  const file = new File(Paths.cache, `lexileap-backup-${dayKey()}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(createBackupData(profiles, progress)));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save LexiLeap backup' });
}

/**
 * Lets the parent pick a backup file and returns its contents, validated.
 * Returns null if they cancel. Nothing is changed until `applyBackup` is called.
 */
export async function pickBackup(): Promise<ReturnType<typeof parseBackup> | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const text = await new File(result.assets[0].uri).text();
  return parseBackup(text);
}

/** Replaces the children and progress on this device. The parent PIN is kept. */
export function applyBackup(data: ReturnType<typeof parseBackup>): void {
  useAppStore.setState({ profiles: data.profiles, progress: data.progress, activeProfileId: null });
}
