/** A delayed/background tick cannot manufacture study time. */
export function activeSeconds(
  now: number,
  last: number,
  interaction: number,
  visible: boolean,
  focused: boolean,
) {
  return visible && focused && now - interaction < 60000
    ? Math.min(5, Math.max(0, (now - last) / 1000))
    : 0;
}
