export type Bounds = {
  width: number;
  height: number;
  top: number;
  bottom: number;
  margin: number;
  size: number;
};
export type Point = { x: number; y: number };

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

export const snapToEdge = (point: Point, bounds: Bounds): Point => {
  'worklet';
  const right = bounds.width - bounds.size - bounds.margin;
  const x = point.x + bounds.size / 2 < bounds.width / 2 ? bounds.margin : right;
  const y = clamp(
    point.y,
    bounds.top + bounds.margin,
    bounds.height - bounds.bottom - bounds.size - bounds.margin,
  );
  return { x, y };
};

export const defaultPosition = (bounds: Bounds, bottomOffset: number): Point => ({
  x: bounds.width - bounds.size - bounds.margin,
  y: bounds.height - bounds.bottom - bottomOffset - bounds.size - bounds.margin,
});
