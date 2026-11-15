/** Tamanho de cada trecho desenhado no Maps SDK do Android. A geometria completa é preservada. */
export const POLYLINE_SEGMENT_SIZE = 180;

/**
 * Parte a polyline em trechos contínuos (o último ponto de um trecho é o primeiro do seguinte).
 * Um único overlay com milhares de vértices encerra o processo no Android.
 */
export function splitPolylineSegments<T>(points: readonly T[], segmentSize = POLYLINE_SEGMENT_SIZE): T[][] {
  if (points.length < 2) return [];
  if (points.length <= segmentSize) return [points.slice()];
  const size = Math.max(2, segmentSize);
  const segments: T[][] = [];
  let start = 0;
  while (start < points.length - 1) {
    const end = Math.min(points.length, start + size);
    segments.push(points.slice(start, end));
    if (end >= points.length) break;
    start = end - 1;
  }
  return segments;
}
