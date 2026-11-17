import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { NativeModules, StyleSheet, View } from 'react-native';
import { analyzeFace } from '@/engine/focus';
import { checkLetter } from '@/handwriting/recognize';
import type { InkStroke } from '@/handwriting/raster';
import { isFaceDetectionAvailable, readFace } from '@/services/faceDetection';
import { loadEmotionModel } from '@/services/emotionModel';
import { loadHandwritingModel } from '@/services/handwritingModel';
import { runEmotionModel } from '@/emotion/model';
import { loadDictionary } from '@/services/pronunciationDictionary';
import { isSpeechRecognitionAvailable, listenForWord } from '@/services/speechRecognition';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

/**
 * Developer diagnostics for testing on a real device (development builds only): checks the native
 * modules and times the on-device models. Results are shown and logged with a "[dev-check]" prefix.
 * Open with the link lexileap://dev-check.
 */
export default function DevCheck() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Checks />;
}

const L_STROKES: InkStroke[] = [
  [...Array.from({ length: 20 }, (_, i) => ({ x: 90, y: 40 + i * 11 })), ...Array.from({ length: 12 }, (_, i) => ({ x: 90 + i * 11, y: 260 }))],
];

function Checks() {
  const [lines, setLines] = useState<string[]>([]);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const log = (line: string) => {
    console.log(`[dev-check] ${line}`);
    setLines((list) => [...list, line]);
  };

  useEffect(() => {
    const run = async () => {
      log(`speech recognition available: ${isSpeechRecognitionAvailable()}`);
      log(`face detection native module: ${!!NativeModules.FaceDetection} (available: ${isFaceDetectionAvailable()})`);
      let t = Date.now();
      const dictionary = await loadDictionary();
      log(`dictionary: ${dictionary.size} words in ${Date.now() - t} ms`);
      t = Date.now();
      const model = await loadHandwritingModel();
      log(`handwriting model loaded in ${Date.now() - t} ms`);
      t = Date.now();
      const emotionModel = await loadEmotionModel();
      log(`emotion model loaded in ${Date.now() - t} ms`);
      t = Date.now();
      const emotions = runEmotionModel(emotionModel, new Float32Array(64 * 64));
      log(`emotion model ran in ${Date.now() - t} ms (blank face → ${Object.entries(emotions).sort((a, b) => b[1] - a[1])[0][0]})`);
      for (const target of ['L', 'b']) {
        t = Date.now();
        const result = checkLetter(model, L_STROKES, target);
        log(`checkLetter(drawn L, target ${target}): read ${result?.read}, correct ${result?.correct}, reversal ${result?.reversal} in ${Date.now() - t} ms`);
      }
    };
    run().catch((e) => log(`error: ${String(e)}`));
  }, []);

  const testMic = async () => {
    log('listening for "cat"… say it now');
    await listenForWord('cat', {
      onResult: (transcripts) => log(`heard: ${JSON.stringify(transcripts)}`),
      onError: (error) => log(`listen error: ${error}`),
    });
  };

  const testCamera = async () => {
    if (!permission?.granted) {
      const granted = (await requestPermission()).granted;
      return log(granted ? 'camera allowed: tap Test camera again' : 'camera permission denied');
    }
    const t = Date.now();
    const photo = await camera.current?.takePictureAsync({ quality: 0.1, shutterSound: false });
    if (!photo) return log('no photo');
    const face = await readFace(photo.uri);
    new File(photo.uri).delete();
    log(`face: ${JSON.stringify(face)} → ${JSON.stringify(analyzeFace(face))} in ${Date.now() - t} ms`);
  };

  return (
    <Screen scroll header={<Header title="Device check" subtitle="Development build diagnostics" />}>
      <View style={styles.row}>
        <Button label="Test microphone" icon="mic" compact onPress={() => void testMic()} style={styles.flex} />
        <Button label="Test camera" icon="camera" compact onPress={() => void testCamera()} style={styles.flex} />
      </View>
      {permission?.granted ? <CameraView ref={camera} style={styles.camera} facing="front" mute /> : null}
      <Card style={styles.log}>
        {lines.map((line, i) => (
          <AppText key={i} variant="caption">
            {line}
          </AppText>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  camera: { width: 160, height: 120, marginTop: 12, alignSelf: 'center' },
  log: { gap: 6, marginTop: 12 },
});
