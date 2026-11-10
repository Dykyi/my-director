const SILENCE_DB = -90;
const METER_FLOOR_DB = -60;

export const rms = (samples: Float32Array): number =>
  Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);

export const levelDb = (level: number): number =>
  level > 0 ? Math.max(SILENCE_DB, Math.round(20 * Math.log10(level))) : SILENCE_DB;

export const litBars = (db: number, bars: number): number =>
  Math.round(((db - METER_FLOOR_DB) / -METER_FLOOR_DB) * bars);
