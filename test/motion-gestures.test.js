import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionInterpreter } from '../src/motion-gestures.js';

function standingPose() {
  const pose = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: 1 }));
  Object.assign(pose[0], { x: .5, y: .15 });
  Object.assign(pose[11], { x: .42, y: .33 });
  Object.assign(pose[12], { x: .58, y: .33 });
  Object.assign(pose[15], { x: .36, y: .53 });
  Object.assign(pose[16], { x: .64, y: .53 });
  Object.assign(pose[23], { x: .45, y: .56 });
  Object.assign(pose[24], { x: .55, y: .56 });
  Object.assign(pose[25], { x: .45, y: .73 });
  Object.assign(pose[26], { x: .55, y: .73 });
  Object.assign(pose[27], { x: .45, y: .9 });
  Object.assign(pose[28], { x: .55, y: .9 });
  return pose;
}

function calibrate(interpreter) {
  for (let index = 0; index < 18; index++) interpreter.update(standingPose(), [], index / 15);
}

test('motion control requires a visible full body and stops on tracking loss', () => {
  const input = createMotionInterpreter();
  assert.equal(input.update(null, [], 0).mode, 'stop');
  const pose = standingPose();
  pose[27].visibility = .1;
  assert.equal(input.update(pose, [], .1).tracked, false);
  calibrate(input);
  assert.equal(input.update(standingPose(), [], 2).calibrated, true);
  assert.equal(input.update(null, [], 2.1).forward, 0);
});

test('alternating steps walk, faster higher steps run, and pausing stops', () => {
  const input = createMotionInterpreter();
  calibrate(input);
  const step = (side, at, height = .08) => {
    const pose = standingPose();
    pose[side === 'left' ? 27 : 28].y -= height;
    return input.update(pose, [], at);
  };
  step('left', 1.4);
  assert.equal(step('right', 2.05).mode, 'walk');
  assert.equal(step('left', 2.7).mode, 'walk');
  assert.equal(input.update(standingPose(), [], 4).mode, 'stop');
  step('left', 4.2, .1);
  step('right', 4.53, .1);
  step('left', 4.86, .1);
  const running = input.update(standingPose(), [], 5.25);
  assert.equal(running.mode, 'run');
  assert.equal(running.forward, 1);
  assert.equal(input.update(standingPose(), [], 6.3).mode, 'stop');
});

test('raising the left hand toggles the menu once until the hand lowers', () => {
  const input = createMotionInterpreter();
  calibrate(input);
  const raised = standingPose();
  raised[15].y = .25;
  assert.deepEqual(input.update(raised, [], 2).events, []);
  assert.deepEqual(input.update(raised, [], 2.8).events, ['toggleMenu']);
  assert.deepEqual(input.update(raised, [], 3.1).events, []);
  input.update(standingPose(), [], 3.2);
  input.update(raised, [], 3.3);
  assert.deepEqual(input.update(raised, [], 4.1).events, ['toggleMenu']);
});

test('right hand fist interacts once, while an open hand provides a cursor', () => {
  const input = createMotionInterpreter();
  calibrate(input);
  const fist = Array.from({ length: 21 }, () => ({ x: .64, y: .53 }));
  fist[9] = { x: .64, y: .47 };
  assert.deepEqual(input.update(standingPose(), [{ landmarks: fist }], 2).events, []);
  assert.deepEqual(input.update(standingPose(), [{ landmarks: fist }], 2.5).events, ['interact']);
  assert.deepEqual(input.update(standingPose(), [{ landmarks: fist }], 3).events, []);
  input.update(standingPose(), [], 3.1);

  const palm = Array.from({ length: 21 }, () => ({ x: .64, y: .53 }));
  for (const index of [5, 9, 13, 17]) palm[index] = { x: .64, y: .48 };
  for (const index of [8, 12, 16, 20]) palm[index] = { x: .64, y: .37 };
  palm[4] = { x: .65, y: .38 };
  const result = input.update(standingPose(), [{ landmarks: palm }], 3.2);
  assert.ok(result.cursor);
  assert.equal(result.pinch, true);
  assert.deepEqual(result.events, []);
});
