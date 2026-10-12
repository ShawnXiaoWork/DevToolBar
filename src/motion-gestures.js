const P = {
  nose: 0, leftShoulder: 11, rightShoulder: 12, leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const visible = point => point && (point.visibility ?? 1) > 0.55 && point.x > 0.02 && point.x < 0.98 && point.y > 0.01 && point.y < 0.99;

function nearestHand(hands, wrist) {
  let best = null;
  let bestDistance = 0.18;
  for (const hand of hands ?? []) {
    const points = hand?.landmarks;
    if (!points?.[0]) continue;
    const currentDistance = distance(points[0], wrist);
    if (currentDistance < bestDistance) { best = points; bestDistance = currentDistance; }
  }
  return best;
}

function handShape(points) {
  if (!points) return { pinch: false, fist: false, open: false, tip: null };
  const palm = Math.max(0.01, distance(points[0], points[9]));
  const extended = [8, 12, 16, 20].filter((tip, index) =>
    distance(points[tip], points[0]) > distance(points[[5, 9, 13, 17][index]], points[0]) * 1.45).length;
  return {
    pinch: distance(points[4], points[8]) < palm * 0.42,
    fist: extended <= 1 && distance(points[8], points[0]) < palm * 1.75,
    open: extended >= 3,
    tip: points[8],
  };
}

export function createMotionInterpreter() {
  let baseline = null;
  let sampleCount = 0;
  let lastLeg = 0;
  let lastStepSide = 0;
  let lastStep = -Infinity;
  let steps = [];
  let runSince = null;
  let running = false;
  let leftRaisedSince = null;
  let leftGestureConsumed = false;
  let fistSince = null;
  let fistConsumed = false;
  let mouthSince = null;
  let mouthConsumed = false;
  let previousLook = null;
  let previousZoom = null;

  function reset() {
    baseline = null; sampleCount = 0; lastLeg = 0; lastStepSide = 0; lastStep = -Infinity; steps = [];
    runSince = null; running = false; leftRaisedSince = null; leftGestureConsumed = false;
    fistSince = null; fistConsumed = false; mouthSince = null; mouthConsumed = false;
    previousLook = null; previousZoom = null;
  }

  function update(pose, hands, now, options = {}) {
    const empty = { tracked: false, calibrated: Boolean(baseline), mode: 'stop', forward: 0,
      steer: 0, lookX: 0, lookY: 0, zoom: 0, cursor: null, pinch: false, events: [] };
    if (!pose || [P.nose, P.leftShoulder, P.rightShoulder, P.leftWrist, P.rightWrist,
      P.leftHip, P.rightHip, P.leftKnee, P.rightKnee, P.leftAnkle, P.rightAnkle]
      .some(index => !visible(pose[index]))) {
      lastLeg = 0; lastStepSide = 0; steps = []; running = false; runSince = null;
      leftRaisedSince = fistSince = mouthSince = previousLook = previousZoom = null;
      return empty;
    }

    const shoulders = mid(pose[P.leftShoulder], pose[P.rightShoulder]);
    const hips = mid(pose[P.leftHip], pose[P.rightHip]);
    const width = Math.max(0.06, distance(pose[P.leftShoulder], pose[P.rightShoulder]));
    const legLength = Math.max(0.12, (distance(pose[P.leftHip], pose[P.leftAnkle])
      + distance(pose[P.rightHip], pose[P.rightAnkle])) / 2);
    const rightHand = handShape(nearestHand(hands, pose[P.rightWrist]));
    const leftHand = handShape(nearestHand(hands, pose[P.leftWrist]));
    const output = { ...empty, tracked: true };

    if (!baseline) {
      const sample = { leftAnkle: pose[P.leftAnkle].y, rightAnkle: pose[P.rightAnkle].y,
        torsoDepth: shoulders.z - hips.z };
      if (!sampleCount) baseline = sample;
      else for (const key of Object.keys(sample)) baseline[key] += (sample[key] - baseline[key]) / (sampleCount + 1);
      sampleCount++;
      output.calibrated = sampleCount >= 18;
      output.calibrationProgress = Math.min(1, sampleCount / 18);
      if (!output.calibrated) return output;
    }
    output.calibrated = true;

    const leftLift = (baseline.leftAnkle - pose[P.leftAnkle].y) / legLength;
    const rightLift = (baseline.rightAnkle - pose[P.rightAnkle].y) / legLength;
    const leg = leftLift > 0.13 && leftLift > rightLift + 0.07 ? 1
      : rightLift > 0.13 && rightLift > leftLift + 0.07 ? -1 : 0;
    if (leg && leg !== lastLeg && leg !== lastStepSide && now - lastStep > 0.22) {
      lastStep = now;
      lastStepSide = leg;
      steps.push({ at: now, lift: Math.max(leftLift, rightLift) });
      steps = steps.filter(step => now - step.at < 2.4);
    }
    lastLeg = leg;
    const intervals = steps.slice(1).map((step, index) => step.at - steps[index].at);
    const cadence = intervals.length ? 1 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length) : 0;
    const recent = now - lastStep < Math.max(0.65, Math.min(1.1, cadence ? 1.5 / cadence : 0.9));
    if (!recent) { steps = []; lastStepSide = 0; }
    const fastSteps = recent && steps.length >= 3 && cadence >= 2.2
      && steps.slice(-3).every(step => step.lift > 0.19);
    if (fastSteps) runSince ??= now;
    else runSince = null;
    if (runSince !== null && now - runSince > 0.35) running = true;
    if (!recent || cadence < 1.65) running = false;
    const moving = steps.length >= 2 && recent && !options.menuOpen;
    output.mode = moving ? running ? 'run' : 'walk' : 'stop';
    output.stepRate = moving ? cadence : 0;
    // MediaPipe world depth is relative to the hips; a sufficiently large backward lean reverses stepping.
    const depthDelta = shoulders.z - hips.z - baseline.torsoDepth;
    output.forward = moving ? depthDelta > 0.12 ? -1 : 1 : 0;
    output.steer = moving ? clamp((hips.x - shoulders.x) / width * 1.8, -0.75, 0.75) : 0;

    const leftRaised = pose[P.leftWrist].y < pose[P.leftShoulder].y - width * 0.25;
    if (leftRaised) leftRaisedSince ??= now;
    else { leftRaisedSince = null; leftGestureConsumed = false; }
    if (leftRaisedSince !== null && !leftGestureConsumed && now - leftRaisedSince > 0.7) {
      output.events.push('toggleMenu'); leftGestureConsumed = true;
    }

    const rightWrist = pose[P.rightWrist];
    const mouth = pose[P.nose];
    const nearMouth = rightHand.open && distance(rightHand.tip, mouth) < width * 0.43;
    if (nearMouth) mouthSince ??= now;
    else { mouthSince = null; mouthConsumed = false; }
    if (mouthSince !== null && !mouthConsumed && now - mouthSince > 0.55) {
      output.events.push('useItem'); mouthConsumed = true;
    }

    const fist = rightHand.fist && !options.menuOpen && rightWrist.y > shoulders.y - width * 0.3;
    if (fist) fistSince ??= now;
    else { fistSince = null; fistConsumed = false; }
    if (fistSince !== null && !fistConsumed && now - fistSince > 0.42) {
      output.events.push('interact'); fistConsumed = true;
    }

    if (rightHand.tip && (rightHand.open || rightHand.pinch)) {
      output.cursor = {
        x: clamp(0.5 + (shoulders.x - rightHand.tip.x) / (width * 3.2), 0.02, 0.98),
        y: clamp(0.47 + (rightHand.tip.y - shoulders.y) / Math.max(0.12, (hips.y - shoulders.y) * 2.1), 0.02, 0.98),
      };
      output.pinch = rightHand.pinch;
    }

    const looking = !options.menuOpen && rightHand.open && rightWrist.y < shoulders.y - width * 0.16
      && !nearMouth && !leftRaised;
    if (looking && previousLook) {
      output.lookX = clamp((rightWrist.x - previousLook.x) / width, -0.35, 0.35);
      output.lookY = clamp((rightWrist.y - previousLook.y) / width, -0.35, 0.35);
    }
    previousLook = looking ? { x: rightWrist.x, y: rightWrist.y } : null;

    const zooming = !options.menuOpen && !moving && !leftRaised && leftHand.open && rightHand.open
      && pose[P.leftWrist].y > shoulders.y && pose[P.rightWrist].y > shoulders.y
      && pose[P.leftWrist].y < hips.y && pose[P.rightWrist].y < hips.y;
    const handGap = distance(pose[P.leftWrist], rightWrist) / width;
    if (zooming && previousZoom !== null) output.zoom = clamp(previousZoom - handGap, -0.2, 0.2);
    previousZoom = zooming ? handGap : null;
    return output;
  }

  return { update, reset };
}
