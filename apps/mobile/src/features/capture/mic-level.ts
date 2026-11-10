export const METER_BARS = 5;
const METER_FLOOR_DB = -60;

export function litBars(levelDb: number): number {
  const ratio = Math.min(1, Math.max(0, (levelDb - METER_FLOOR_DB) / -METER_FLOOR_DB));
  return Math.ceil(ratio * METER_BARS);
}
