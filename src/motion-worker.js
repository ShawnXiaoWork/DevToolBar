import { FilesetResolver, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

let poseLandmarker = null;
let handLandmarker = null;

self.onmessage = async event => {
  const { type } = event.data;
  if (type === 'init') {
    try {
      const { baseUrl } = event.data;
      const fileset = await FilesetResolver.forVisionTasks(`${baseUrl}mediapipe/wasm`, true);
      // MediaPipe's loader expects a global factory. Importing explicitly also works in module Workers.
      const wasmModule = await import(/* @vite-ignore */ fileset.wasmLoaderPath);
      fileset.wasmLoaderPath = undefined;
      self.ModuleFactory = wasmModule.default;
      poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${baseUrl}models/pose_landmarker_lite.task`, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      self.ModuleFactory = wasmModule.default;
      handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${baseUrl}models/hand_landmarker.task`, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: `识别模型加载失败：${error.message}` });
    }
  }
  if (type === 'frame') {
    const { bitmap, timestamp } = event.data;
    try {
      if (!poseLandmarker || !handLandmarker) throw new Error('识别模型尚未就绪');
      const poseResult = poseLandmarker.detectForVideo(bitmap, timestamp);
      const handResult = handLandmarker.detectForVideo(bitmap, timestamp);
      self.postMessage({
        type: 'result', timestamp,
        pose: poseResult.landmarks?.[0] ?? null,
        hands: (handResult.landmarks ?? []).map(landmarks => ({ landmarks })),
      });
    } catch (error) {
      self.postMessage({ type: 'error', message: `姿态识别中断：${error.message}` });
    } finally {
      bitmap.close();
    }
  }
};
