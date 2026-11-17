import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { parseModel, type HandwritingModel } from '@/handwriting/model';
import modelAsset from '../../assets/models/handwriting.bin';

let loading: Promise<HandwritingModel> | null = null;

/** Loads the bundled handwriting model (~400 KB) once, on first use. */
export function loadHandwritingModel(): Promise<HandwritingModel> {
  if (!loading) {
    loading = (async () => {
      const [asset] = await Asset.loadAsync(modelAsset);
      return parseModel(await new File(asset.localUri ?? asset.uri).arrayBuffer());
    })().catch((error) => {
      loading = null; // allow a retry
      throw error;
    });
  }
  return loading;
}

export type ModelState = { status: 'loading' } | { status: 'ready'; model: HandwritingModel } | { status: 'error' };

/** The handwriting model for a screen, loaded in the background. */
export function useHandwritingModel(): ModelState {
  const [state, setState] = useState<ModelState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    loadHandwritingModel().then(
      (model) => active && setState({ status: 'ready', model }),
      () => active && setState({ status: 'error' }),
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
