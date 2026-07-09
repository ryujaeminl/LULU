import { Point2D, Point3D } from '../types/gaze';

export function distance2D(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function distance3D(p1: Point3D, p2: Point3D): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2)
  );
}

/**
 * Calculates the Eye Aspect Ratio (EAR) using 6 landmark points.
 * Indices refer to standard landmark mapping for eyes:
 * p1: Inner corner
 * p4: Outer corner
 * p2, p3: Upper eyelid points
 * p5, p6: Lower eyelid points
 */
export function calculateEAR(
  p1: Point3D,
  p2: Point3D,
  p3: Point3D,
  p4: Point3D,
  p5: Point3D,
  p6: Point3D
): number {
  const vert1 = distance3D(p2, p6);
  const vert2 = distance3D(p3, p5);
  const horiz = distance3D(p1, p4);
  
  return (vert1 + vert2) / (2.0 * Math.max(0.0001, horiz));
}

/**
 * Calculates the bounding box for cropping eyes based on landmark collections
 */
export function getEyeCropBox(
  landmarks: Point3D[],
  eyeIndices: number[],
  padding = 0.3
) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const idx of eyeIndices) {
    const pt = landmarks[idx];
    if (!pt) continue;
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const cx = minX + width / 2;
  const cy = minY + height / 2;

  const size = Math.max(width, height) * (1 + padding);

  return {
    x: Math.max(0, cx - size / 2),
    y: Math.max(0, cy - size / 2),
    width: size,
    height: size,
  };
}
