import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_INPUT_MODE, resolveInputMode } from '../src/input-config.js';

test('computer mode is the default and URL parameter can override it', () => {
  assert.equal(DEFAULT_INPUT_MODE, 'computer');
  assert.equal(resolveInputMode(''), 'computer');
  assert.equal(resolveInputMode('?input=motion'), 'motion');
  assert.equal(resolveInputMode('?input=computer'), 'computer');
  assert.equal(resolveInputMode('?input=invalid'), 'computer');
});
