export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(start: number, end: number, amt: number): number {
  return (1 - amt) * start + amt * end;
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

export function stdDev(arr: number[], avg?: number): number {
  if (arr.length <= 1) return 0;
  const mu = avg !== undefined ? avg : mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mu, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Filter outliers using Interquartile Range (IQR) method.
 * Returns indices of non-outliers.
 */
export function filterOutliersIQR(values: number[]): boolean[] {
  if (values.length < 4) return new Array(values.length).fill(true);
  
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return values.map(v => v >= lowerBound && v <= upperBound);
}
