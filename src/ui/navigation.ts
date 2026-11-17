import { router } from 'expo-router';

/** Goes back, or to `fallback` when there is nothing to go back to (e.g. after opening a link). */
export function goBackOr(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
