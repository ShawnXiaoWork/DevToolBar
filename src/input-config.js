// Change this value to 'motion' to make webcam control the startup mode.
export const DEFAULT_INPUT_MODE = 'computer';

export function resolveInputMode(search = '') {
  const requested = new URLSearchParams(search).get('input');
  return requested === 'computer' || requested === 'motion' ? requested : DEFAULT_INPUT_MODE;
}
