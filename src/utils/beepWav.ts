/**
 * Gera WAV dos mesmos beeps das telas de leitura do front (saídas/coletas).
 * Frontend: AudioContext + oscillators (ok=sine 1046+1318Hz, warn=triangle 660Hz, err=square 220+180Hz).
 */

const SAMPLE_RATE = 44100;

function sampleAt(
  t: number,
  freq: number,
  type: "sine" | "triangle" | "square",
  vol: number
): number {
  const phase = (t * freq) % 1;
  let v: number;
  if (type === "sine") {
    v = Math.sin(2 * Math.PI * phase);
  } else if (type === "triangle") {
    v = phase < 0.25 ? 4 * phase : phase < 0.75 ? 2 - 4 * phase : 4 * phase - 4;
  } else {
    v = phase < 0.5 ? 1 : -1;
  }
  return Math.max(-1, Math.min(1, v * vol)) * 32767;
}

function envelope(
  t: number,
  start: number,
  dur: number
): number {
  if (t < start || t >= start + dur) return 0;
  const local = t - start;
  const attack = Math.min(0.01, dur * 0.1);
  const release = Math.min(0.02, dur * 0.2);
  if (local < attack) return local / attack;
  if (local > dur - release) return (dur - local) / release;
  return 1;
}

/** Um beep: freq (Hz), dur (ms), type, vol, when (ms). Escreve em samples no offset correto. */
function addBeep(
  samples: Float32Array,
  freq: number,
  dur: number,
  type: "sine" | "triangle" | "square",
  vol: number,
  whenMs: number
): void {
  const when = whenMs / 1000;
  const durSec = dur / 1000;
  const startIdx = Math.floor(when * SAMPLE_RATE);
  const beepSamples = Math.ceil(durSec * SAMPLE_RATE);
  for (let i = 0; i < beepSamples; i++) {
    const idx = startIdx + i;
    if (idx >= samples.length) break;
    const t = idx / SAMPLE_RATE;
    const env = envelope(t, when, durSec);
    const s = sampleAt(t, freq, type, vol * env);
    samples[idx] = (samples[idx] || 0) + s;
  }
}

function floatTo16BitPCM(samples: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const n = Math.max(-32768, Math.min(32767, Math.round(samples[i])));
    view.setInt16(i * 2, n, true);
  }
  return buf;
}

function createWavBuffer(pcm: ArrayBuffer): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const dataSize = pcm.byteLength;
  const headerSize = 44;
  const total = headerSize + dataSize;

  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  let off = 0;

  function writeStr(s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(off++, s.charCodeAt(i));
  }
  function write32(v: number) {
    view.setUint32(off, v, true);
    off += 4;
  }
  function write16(v: number) {
    view.setUint16(off, v, true);
    off += 2;
  }

  writeStr("RIFF");
  write32(36 + dataSize);
  writeStr("WAVE");
  writeStr("fmt ");
  write32(16);
  write16(1); // PCM
  write16(numChannels);
  write32(SAMPLE_RATE);
  write32(byteRate);
  write16(numChannels * (bitsPerSample / 8));
  write16(bitsPerSample);
  writeStr("data");
  write32(dataSize);

  new Uint8Array(buf).set(new Uint8Array(pcm), 44);
  return buf;
}

/** Mesma sequência do front: ok = dois sines; warn = dois triangles; err = dois squares; celebration = arpejo ascendente */
export function generateBeepWav(
  kind: "ok" | "warn" | "err" | "celebration"
): ArrayBuffer {
  let durationMs = 0;
  const vol = 1.0;

  if (kind === "ok") {
    durationMs = 200;
  } else if (kind === "warn") {
    durationMs = 280;
  } else if (kind === "celebration") {
    durationMs = 720;
  } else {
    durationMs = 480;
  }

  const numSamples = Math.ceil((durationMs / 1000) * SAMPLE_RATE);
  const samples = new Float32Array(numSamples);

  if (kind === "ok") {
    addBeep(samples, 1046, 90, "sine", vol, 0);
    addBeep(samples, 1318, 140, "sine", vol, 60);
  } else if (kind === "warn") {
    addBeep(samples, 660, 120, "triangle", vol, 0);
    addBeep(samples, 660, 120, "triangle", vol, 160);
  } else if (kind === "celebration") {
    addBeep(samples, 523, 130, "sine", vol * 0.9, 0);
    addBeep(samples, 659, 130, "sine", vol * 0.95, 100);
    addBeep(samples, 784, 140, "sine", vol, 200);
    addBeep(samples, 1046, 200, "sine", vol, 320);
  } else {
    addBeep(samples, 220, 240, "square", vol, 0);
    addBeep(samples, 180, 220, "square", vol, 260);
  }

  const pcm = floatTo16BitPCM(samples);
  return createWavBuffer(pcm);
}
