#!/usr/bin/env node
// lib/audio.mjs — trilha e efeitos sintetizados em Node puro (sem dependências) + análise de trilhas externas.
//
// Sintetizar:
//   node lib/audio.mjs videos/<nome> --duration 8 --bpm 120 --style energetico --events "0:impact,2:whoosh,3.5:riser"
// Usar trilha de audio/ (mede duração, BPM e batidas fortes; corta e grava audio.wav + beats.json):
//   node lib/audio.mjs videos/<nome> --track audio/minha.mp3 --duration 15 [--start 12.5]
// Em código:
//   import { makeAudio, beatGrid, analyzeTrack } from '../lib/audio.mjs'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SR = 48000;
const TAU = Math.PI * 2;
export const STYLES = ['energetico', 'minimalista', 'cinematografico', 'lofi'];
const STYLE_ALIASES = { 'energético': 'energetico', 'cinematográfico': 'cinematografico', 'lo-fi': 'lofi', energetic: 'energetico', minimal: 'minimalista', cinematic: 'cinematografico' };

// ---------------------------------------------------------------- grade
/** Grade de batidas. beats = todas as batidas; bars = tempos de compasso (batidas fortes); halfBars a cada 2 batidas. */
export function beatGrid({ duration, bpm = 120, offset = 0, beatsPerBar = 4 }) {
  const spb = 60 / bpm;
  const beats = [];
  for (let t = offset; t <= duration + 1e-9; t += spb) beats.push(+t.toFixed(6));
  return {
    bpm, spb, offset, beatsPerBar, duration,
    beats,
    bars: beats.filter((_, i) => i % beatsPerBar === 0),
    halfBars: beats.filter((_, i) => i % 2 === 0),
    strong: beats.filter((_, i) => i % beatsPerBar === 0),
  };
}

// ---------------------------------------------------------------- utilitários DSP
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296 * 2 - 1;
  };
}
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const lpCoef = (fc) => 1 - Math.exp(-TAU * Math.min(fc, SR * 0.45) / SR);

class Bus {
  constructor(n) { this.L = new Float32Array(n); this.R = new Float32Array(n); this.n = n; }
  add(i, v, pan = 0) {
    if (i < 0 || i >= this.n) return;
    const a = (pan + 1) * Math.PI / 4;
    this.L[i] += v * Math.cos(a) * 1.414; this.R[i] += v * Math.sin(a) * 1.414;
  }
}

/** Reverb Schroeder simples (4 combs + 2 allpass por canal). */
function reverb(bus, { size = 0.8, damp = 0.3, mix = 1 } = {}) {
  const out = new Bus(bus.n);
  const combs = [1557, 1617, 1491, 1422], aps = [225, 556];
  for (const [ch, src, dst, spread] of [[0, bus.L, out.L, 0], [1, bus.R, out.R, 23]]) {
    const acc = new Float32Array(bus.n);
    for (const c of combs) {
      const d = Math.round((c + spread) * SR / 44100);
      const buf = new Float32Array(d); let idx = 0, lp = 0;
      for (let i = 0; i < bus.n; i++) {
        const y = buf[idx];
        lp = y * (1 - damp) + lp * damp;
        buf[idx] = src[i] + lp * size;
        acc[i] += y; idx = (idx + 1) % d;
      }
    }
    let sig = acc;
    for (const a of aps) {
      const d = Math.round((a + spread) * SR / 44100);
      const buf = new Float32Array(d); let idx = 0;
      const o = new Float32Array(bus.n);
      for (let i = 0; i < bus.n; i++) {
        const b = buf[idx]; const x = sig[i];
        o[i] = -x + b; buf[idx] = x + b * 0.5; idx = (idx + 1) % d;
      }
      sig = o;
    }
    for (let i = 0; i < bus.n; i++) dst[i] = sig[i] * 0.12 * mix;
  }
  return out;
}

// ---------------------------------------------------------------- instrumentos (escrevem num Bus)
const I = {
  kick(bus, t, { gain = 1, pitch = 1, len = 0.45, click = 1 } = {}) {
    const s = Math.round(t * SR), n = Math.round(len * SR); let ph = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      const f = (48 + 110 * Math.exp(-tt * 28)) * pitch;
      ph += TAU * f / SR;
      const env = Math.exp(-tt * (5.5 / len)) * Math.min(1, i / 24);
      const clk = click * Math.exp(-tt * 300) * 0.35;
      bus.add(s + i, Math.tanh(Math.sin(ph) * env * 1.6 + clk) * 0.9 * gain);
    }
  },
  snare(bus, t, { gain = 1, len = 0.22, rnd, tone = 190, bright = 1 } = {}) {
    const s = Math.round(t * SR), n = Math.round(len * SR);
    let hp = 0, prev = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR, x = rnd();
      hp = 0.85 * (hp + x - prev); prev = x;
      ph += TAU * tone * (1 + 0.5 * Math.exp(-tt * 40)) / SR;
      const v = hp * Math.exp(-tt * 18 / (len / 0.22)) * 0.55 * bright + Math.sin(ph) * Math.exp(-tt * 30) * 0.45;
      bus.add(s + i, v * gain * Math.min(1, i / 16), 0.05);
    }
  },
  hat(bus, t, { gain = 1, open = false, rnd, pan = 0.25 } = {}) {
    const s = Math.round(t * SR), len = open ? 0.28 : 0.05, n = Math.round(len * SR);
    let prev = 0, hp = 0, hp2 = 0, prev2 = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR, x = rnd();
      hp = 0.6 * (hp + x - prev); prev = x;
      hp2 = 0.6 * (hp2 + hp - prev2); prev2 = hp;
      bus.add(s + i, hp2 * Math.exp(-tt * (open ? 14 : 70)) * 0.32 * gain, pan);
    }
  },
  rim(bus, t, { gain = 1 } = {}) {
    const s = Math.round(t * SR), n = Math.round(0.05 * SR); let ph = 0;
    for (let i = 0; i < n; i++) { ph += TAU * 1750 / SR; bus.add(s + i, Math.sin(ph) * Math.exp(-i / SR * 90) * 0.3 * gain, -0.2); }
  },
  bass(bus, t, note, { dur = 0.25, gain = 1, cutoff = 600, wave = 'saw' } = {}) {
    const s = Math.round(t * SR), n = Math.round((dur + 0.05) * SR), f = midi(note);
    let ph = 0, lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      ph = (ph + f / SR) % 1;
      const raw = wave === 'sine' ? Math.sin(TAU * ph) : wave === 'square' ? (ph < 0.5 ? 1 : -1) : 2 * ph - 1;
      const fc = cutoff * (1 + 3 * Math.exp(-tt * 20));
      const a = lpCoef(fc); lp += a * (raw - lp); lp2 += a * (lp - lp2);
      const env = Math.min(1, i / 80) * (tt < dur ? 1 : Math.exp(-(tt - dur) * 60));
      bus.add(s + i, (lp2 * 0.8 + Math.sin(TAU * ph) * 0.4) * env * 0.42 * gain);
    }
  },
  pad(bus, t, notes, { dur = 2, gain = 1, cutoff = 1800, attack = 0.4, release = 0.8, detune = 0.12, rnd } = {}) {
    const s = Math.round(t * SR), n = Math.round((dur + release) * SR);
    const voices = [];
    for (const nt of notes) for (const d of [-detune, 0, detune]) voices.push({ f: midi(nt + d), ph: (rnd() + 1) / 2, pan: d * 4 });
    const lps = voices.map(() => [0, 0]);
    const a = lpCoef(cutoff);
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      const env = Math.min(1, tt / attack) * (tt < dur ? 1 : Math.exp(-(tt - dur) * 4 / release));
      for (let v = 0; v < voices.length; v++) {
        const vo = voices[v]; vo.ph = (vo.ph + vo.f / SR) % 1;
        const raw = 2 * vo.ph - 1, st = lps[v];
        st[0] += a * (raw - st[0]); st[1] += a * (st[0] - st[1]);
        bus.add(s + i, st[1] * env * 0.07 * gain / Math.sqrt(notes.length), vo.pan);
      }
    }
  },
  keys(bus, t, notes, { dur = 0.6, gain = 1 } = {}) { // piano elétrico (lo-fi)
    const s = Math.round(t * SR), n = Math.round((dur + 0.6) * SR);
    for (const [k, nt] of notes.entries()) {
      const f = midi(nt), off = Math.round(k * 0.012 * SR);
      for (let i = 0; i < n; i++) {
        const tt = i / SR;
        const mod = Math.sin(TAU * f * 2 * tt) * 1.2 * Math.exp(-tt * 6);
        const v = Math.sin(TAU * f * tt + mod) * Math.exp(-tt * 2.2) * Math.min(1, i / 60);
        bus.add(s + off + i, v * 0.1 * gain, (k - 1) * 0.2);
      }
    }
  },
  riser(bus, t, { dur = 1.5, gain = 1, rnd } = {}) { // termina em t
    const start = t - dur, s = Math.round(start * SR), n = Math.round(dur * SR);
    let lp = 0, bp = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n, x = rnd();
      const fc = 300 + 7000 * p * p;
      const f = 2 * Math.sin(Math.PI * fc / SR);
      lp += f * bp; const hp = x - lp - 0.4 * bp; bp += f * hp;
      ph += TAU * (200 + 900 * p * p) / SR;
      const env = p ** 2.2;
      bus.add(s + i, (bp * 0.5 + Math.sin(ph) * 0.15) * env * 0.5 * gain, Math.sin(p * 12) * 0.4 * p);
    }
  },
  whoosh(bus, t, { dur = 0.6, gain = 1, rnd } = {}) { // centrado em t
    const s = Math.round((t - dur * 0.6) * SR), n = Math.round(dur * SR);
    let lp = 0, bp = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n, x = rnd();
      const shape = Math.sin(Math.PI * Math.min(1, p / 0.6 * 0.5 + (p > 0.6 ? (p - 0.6) / 0.4 * 0.5 : 0)));
      const fc = 400 + 3800 * Math.sin(Math.PI * p) ** 2;
      const f = 2 * Math.sin(Math.PI * fc / SR);
      lp += f * bp; const hp = x - lp - 0.6 * bp; bp += f * hp;
      bus.add(s + i, bp * shape ** 1.5 * 0.7 * gain, -0.8 + 1.6 * p);
    }
  },
  impact(bus, t, { gain = 1, rnd } = {}) {
    const s = Math.round(t * SR), n = Math.round(1.8 * SR); let ph = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      ph += TAU * (38 + 70 * Math.exp(-tt * 12)) / SR;
      lp += lpCoef(2500 * Math.exp(-tt * 8) + 200) * (rnd() - lp);
      const v = Math.tanh(Math.sin(ph) * Math.exp(-tt * 2.6) * 2.2) * 0.8 + lp * Math.exp(-tt * 9) * 0.9;
      bus.add(s + i, v * gain * Math.min(1, i / 20));
    }
  },
  click(bus, t, { gain = 1, pitch = 1 } = {}) {
    const s = Math.round(t * SR), n = Math.round(0.035 * SR); let ph = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR; ph += TAU * 2600 * pitch * (1 - tt * 8) / SR;
      bus.add(s + i, Math.sin(ph) * Math.exp(-tt * 160) * 0.35 * gain, 0.1);
    }
  },
  drop(bus, t, { gain = 1 } = {}) { // sub que cai de tom
    const s = Math.round(t * SR), n = Math.round(1.2 * SR); let ph = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR; ph += TAU * (90 * Math.exp(-tt * 1.8) + 30) / SR;
      bus.add(s + i, Math.sin(ph) * Math.exp(-tt * 2.5) * Math.min(1, i / 40) * 0.8 * gain);
    }
  },
  vinyl(bus, dur, { gain = 1, rnd } = {}) {
    let lp = 0;
    for (let i = 0; i < Math.round(dur * SR); i++) {
      lp += 0.08 * (rnd() - lp);
      const crackle = rnd() > 0.9994 ? rnd() * 0.6 : 0;
      bus.add(i, (lp * 0.04 + crackle) * gain, rnd() * 0.5);
    }
  },
};

// ---------------------------------------------------------------- arranjo por estilo
const PROG = [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]]; // i7 – VImaj7 – IIImaj7 – VII (menor)

function arrange(style, { duration, bpm, root, music, sfx, verb, rnd, grid }) {
  const spb = 60 / bpm, bars = Math.ceil(duration / (spb * 4)) + 1;
  const end = duration - 0.05;
  const kicks = [];
  const R = root;
  const swing = style === 'lofi' ? 0.16 : 0;
  const sw = (b, sub) => (sub % 2 === 1 ? swing * spb * 0.5 : 0);
  for (let bar = 0; bar < bars; bar++) {
    const t0 = grid.offset + bar * 4 * spb;
    if (t0 > end) break;
    const ch = PROG[bar % 4];
    const chord = ch.map((x) => R + 12 + x);
    const bassNote = R - 12 + ch[0];
    const first = bar === 0;
    if (style === 'energetico') {
      for (let b = 0; b < 4; b++) { kicks.push(t0 + b * spb); I.kick(music, t0 + b * spb, { gain: 1 }); }
      for (const b of [1, 3]) { I.snare(music, t0 + b * spb, { rnd, gain: 0.9 }); I.snare(verb, t0 + b * spb, { rnd, gain: 0.3 }); }
      for (let s = 0; s < 16; s++) if (!first || s >= 8) I.hat(music, t0 + s * spb / 4, { rnd, gain: s % 4 === 2 ? 1 : 0.55, open: s % 8 === 6 });
      for (let s = 0; s < 8; s++) I.bass(music, t0 + s * spb / 2 + spb / 4 * (s % 2), bassNote + (s === 7 ? 12 : 0), { dur: spb * 0.4, cutoff: 700, gain: 0.9 });
      I.pad(music, t0, chord, { dur: 4 * spb, gain: 0.8, cutoff: 2600, attack: 0.05, rnd });
      I.pad(verb, t0, chord, { dur: 4 * spb, gain: 0.5, cutoff: 2600, attack: 0.05, rnd });
    } else if (style === 'minimalista') {
      for (const b of [0, 2]) { kicks.push(t0 + b * spb); I.kick(music, t0 + b * spb, { gain: 0.7, len: 0.35, click: 0.2 }); }
      for (const b of [1, 3]) I.rim(music, t0 + b * spb, { gain: 0.8 });
      for (let s = 0; s < 8; s++) if (s % 2 === 1) I.hat(music, t0 + s * spb / 2, { rnd, gain: 0.35 });
      I.bass(music, t0, bassNote, { dur: spb * 1.5, wave: 'sine', gain: 0.9 });
      I.bass(music, t0 + 2.5 * spb, bassNote + 7, { dur: spb * 0.5, wave: 'sine', gain: 0.6 });
      I.pad(music, t0, chord, { dur: 4 * spb, gain: 0.55, cutoff: 1200, attack: 0.6, rnd });
      I.pad(verb, t0, [chord[3] + 12], { dur: 4 * spb, gain: 0.4, cutoff: 3000, attack: 0.02, rnd });
    } else if (style === 'cinematografico') {
      kicks.push(t0); I.impact(music, t0, { gain: bar % 2 === 0 ? 0.7 : 0.45, rnd }); I.impact(verb, t0, { gain: 0.4, rnd });
      for (const b of [1.5, 2, 3, 3.5]) I.kick(music, t0 + b * spb, { gain: 0.5, pitch: 0.7, len: 0.6, click: 0.1 });
      I.bass(music, t0, R - 24 + ch[0], { dur: 4 * spb, wave: 'saw', cutoff: 180, gain: 1.2 });
      I.pad(music, t0, [...chord, chord[0] + 12], { dur: 4 * spb, gain: 1.1, cutoff: 1400, attack: 0.8, rnd, detune: 0.18 });
      I.pad(verb, t0, [...chord, chord[0] + 12], { dur: 4 * spb, gain: 0.9, cutoff: 1400, attack: 0.8, rnd, detune: 0.18 });
      for (let s = 0; s < 8; s++) I.hat(music, t0 + s * spb / 2, { rnd, gain: 0.2, pan: -0.5 + (s % 2) });
    } else { // lofi
      for (const b of [0, 2.5]) { kicks.push(t0 + b * spb); I.kick(music, t0 + b * spb, { gain: 0.75, len: 0.3, click: 0.05, pitch: 0.9 }); }
      for (const b of [1, 3]) { I.snare(music, t0 + b * spb, { rnd, gain: 0.55, len: 0.18, tone: 160, bright: 0.6 }); I.snare(verb, t0 + b * spb, { rnd, gain: 0.25 }); }
      for (let s = 0; s < 8; s++) I.hat(music, t0 + s * spb / 2 + sw(bar, s), { rnd, gain: s % 2 ? 0.25 : 0.4 });
      I.keys(music, t0, chord, { dur: 2 * spb }); I.keys(music, t0 + 2.5 * spb + sw(0, 1), chord.slice(1), { dur: spb, gain: 0.7 });
      I.keys(verb, t0, chord, { dur: 2 * spb, gain: 0.6 });
      I.bass(music, t0, bassNote, { dur: spb * 1.8, wave: 'sine', gain: 0.9 });
    }
  }
  return kicks;
}

/**
 * Sintetiza a trilha completa. Retorna { L, R, sampleRate, grid }.
 * opts: { duration, bpm=120, style='energetico', events=[{t, type, gain?, dur?}], key='A', seed=1, offset=0 }
 * tipos de evento: whoosh | impact | riser (termina em t) | click | drop | hit (impact + kick) | kick | snare
 */
export function synthesize({ duration, bpm = 120, style = 'energetico', events = [], key = 'A', seed = 1, offset = 0, musicGain = 1, sfxGain = 1 }) {
  style = STYLE_ALIASES[style] || style;
  if (!STYLES.includes(style)) throw new Error(`estilo desconhecido: ${style} (use ${STYLES.join(', ')})`);
  const n = Math.ceil((duration + 2) * SR);
  const music = new Bus(n), sfx = new Bus(n), verb = new Bus(n);
  const rnd = rng(seed * 7919 + 1);
  const root = 57 + (NOTE[key] ?? 9) - 9; // A3 por padrão
  const grid = beatGrid({ duration, bpm, offset });
  const kicks = arrange(style, { duration, bpm, root, music, sfx, verb, rnd, grid });
  if (style === 'lofi') I.vinyl(music, duration, { rnd });

  for (const e of events) {
    const g = e.gain ?? 1;
    switch (e.type) {
      case 'whoosh': I.whoosh(sfx, e.t, { dur: e.dur, gain: g, rnd }); I.whoosh(verb, e.t, { dur: e.dur, gain: g * 0.4, rnd }); break;
      case 'impact': I.impact(sfx, e.t, { gain: g, rnd }); I.impact(verb, e.t, { gain: g * 0.6, rnd }); break;
      case 'riser': I.riser(sfx, e.t, { dur: e.dur ?? 1.5, gain: g, rnd }); break;
      case 'click': I.click(sfx, e.t, { gain: g, pitch: e.pitch }); break;
      case 'drop': I.drop(sfx, e.t, { gain: g }); break;
      case 'hit': I.impact(sfx, e.t, { gain: g * 0.7, rnd }); I.kick(sfx, e.t, { gain: g }); I.snare(verb, e.t, { rnd, gain: g * 0.6 }); break;
      case 'kick': I.kick(sfx, e.t, { gain: g }); break;
      case 'snare': I.snare(sfx, e.t, { rnd, gain: g }); break;
      default: throw new Error(`tipo de evento desconhecido: ${e.type}`);
    }
  }

  // sidechain: abaixa a música após cada bumbo (exceto no próprio bumbo, que vive no mesmo bus — ok, efeito de "bombeamento")
  const duck = new Float32Array(n).fill(1);
  const depth = style === 'energetico' ? 0.45 : style === 'lofi' ? 0.25 : 0.15;
  for (const k of kicks) {
    const s = Math.round(k * SR);
    for (let i = 0; i < 0.25 * SR && s + i < n; i++) duck[s + i] = Math.min(duck[s + i], 1 - depth * Math.exp(-i / SR * 14) * Math.min(1, i / 200));
  }
  const wet = reverb(verb, { size: style === 'cinematografico' ? 0.86 : 0.78, damp: 0.35 });
  const L = new Float32Array(Math.round(duration * SR)), Rr = new Float32Array(L.length);
  const lofi = style === 'lofi';
  let lpL = 0, lpR = 0;
  const aLo = lpCoef(5200);
  for (let i = 0; i < L.length; i++) {
    let l = music.L[i] * duck[i] * musicGain + sfx.L[i] * sfxGain + wet.L[i] * (1 + duck[i]) / 2;
    let r = music.R[i] * duck[i] * musicGain + sfx.R[i] * sfxGain + wet.R[i] * (1 + duck[i]) / 2;
    if (lofi) { lpL += aLo * (l - lpL); lpR += aLo * (r - lpR); l = lpL; r = lpR; }
    L[i] = l; Rr[i] = r;
  }
  master(L, Rr);
  return { L, R: Rr, sampleRate: SR, grid };
}

/** Soft clip + normalização em −1 dBFS + fades de borda. */
function master(L, R) {
  let peak = 0;
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = peak > 0 ? 0.89 / peak : 1;
  const fin = Math.round(0.004 * SR), fout = Math.round(0.35 * SR);
  for (let i = 0; i < L.length; i++) {
    let e = g;
    if (i < fin) e *= i / fin;
    if (i > L.length - fout) e *= (L.length - i) / fout;
    L[i] *= e; R[i] *= e;
  }
}

/** Grava WAV PCM 16-bit estéreo. */
export function writeWav(file, { L, R, sampleRate = SR }) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}

/** Sintetiza e grava <dir>/audio.wav + <dir>/beats.json. Retorna a grade. */
export function makeAudio(dir, opts) {
  mkdirSync(dir, { recursive: true });
  const res = synthesize(opts);
  writeWav(path.join(dir, 'audio.wav'), res);
  const info = { source: 'sintetizado', style: STYLE_ALIASES[opts.style] || opts.style || 'energetico', ...res.grid, events: opts.events || [] };
  writeFileSync(path.join(dir, 'beats.json'), JSON.stringify(info, null, 1));
  return res.grid;
}

// ---------------------------------------------------------------- trilhas externas
async function bins() { return import('../engine/bin.mjs'); }

/** Mede duração, BPM, batidas e batidas fortes de um arquivo de áudio (via ffprobe/ffmpeg). */
export async function analyzeTrack(file, { minBpm = 70, maxBpm = 180 } = {}) {
  const { FFMPEG, FFPROBE } = await bins();
  const probe = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const duration = parseFloat(probe.stdout.toString());
  const sr = 22050;
  const dec = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (dec.status !== 0) throw new Error('ffmpeg não conseguiu decodificar ' + file);
  const x = new Float32Array(dec.stdout.buffer, dec.stdout.byteOffset, Math.floor(dec.stdout.length / 4));
  // envelope de onset: fluxo de energia em 2 bandas (graves pesam mais)
  const hop = 256, win = 1024, frames = Math.floor((x.length - win) / hop);
  const fps = sr / hop;
  const onset = new Float32Array(frames);
  let prevLo = 0, prevAll = 0, lp = 0; const a = lpCoef(150) * SR / sr;
  const loArr = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { lp += Math.min(1, a) * (x[i] - lp); loArr[i] = lp; }
  for (let f = 0; f < frames; f++) {
    let eAll = 0, eLo = 0;
    for (let i = f * hop; i < f * hop + win; i++) { eAll += x[i] * x[i]; eLo += loArr[i] * loArr[i]; }
    const la = Math.log1p(eAll * 100), ll = Math.log1p(eLo * 100);
    onset[f] = Math.max(0, la - prevAll) + 1.5 * Math.max(0, ll - prevLo);
    prevAll = la; prevLo = ll;
  }
  // tempo por autocorrelação com preferência suave por ~120 BPM
  let best = 0, bestLag = 0;
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (let f = 0; f + lag * 2 < frames; f++) {
      const l1 = Math.round(f + lag), l2 = Math.round(f + 2 * lag), l4 = Math.round(f + 4 * lag);
      s += onset[f] * (onset[l1] + 0.5 * onset[l2] + 0.5 * (onset[l4] || 0));
    }
    s *= Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    if (s > best) { best = s; bestLag = lag; }
  }
  const bpm = +(60 * fps / bestLag).toFixed(2);
  // fase: deslocamento que maximiza a energia nas batidas
  let bestPhase = 0, bestSum = -1;
  for (let ph = 0; ph < bestLag; ph += 0.5) {
    let s = 0; for (let f = ph; f < frames; f += bestLag) s += onset[Math.round(f)] || 0;
    if (s > bestSum) { bestSum = s; bestPhase = ph; }
  }
  const spb0 = bestLag / fps;
  const offset = ((bestPhase / fps + (win * 0.8) / sr) % spb0 + spb0) % spb0; // compensa a latência da janela
  // compasso: qual das 4 batidas é a mais forte → downbeat
  const grid = beatGrid({ duration, bpm, offset });
  const strengthAt = (t) => { const f = Math.round(t * fps); let m = 0; for (let k = -2; k <= 2; k++) m = Math.max(m, onset[f + k] || 0); return m; };
  const acc = [0, 0, 0, 0];
  grid.beats.forEach((t, i) => { acc[i % 4] += strengthAt(t); });
  const down = acc.indexOf(Math.max(...acc));
  const strong = grid.beats.filter((_, i) => i % 4 === down);
  const sorted = grid.beats.map((t) => ({ t, s: strengthAt(t) })).sort((p, q) => q.s - p.s);
  const accents = sorted.slice(0, Math.max(4, Math.round(grid.beats.length / 6))).map((p) => p.t).sort((p, q) => p - q);
  return { file, duration, bpm, offset, beats: grid.beats, bars: strong, strong, accents };
}

/** Converte/corta uma trilha para <dir>/audio.wav (48 kHz) começando num downbeat, com fade-out; grava beats.json. */
export async function prepareTrack(dir, file, { duration, start } = {}) {
  const { FFMPEG } = await bins();
  const info = await analyzeTrack(file);
  const s0 = start ?? (info.strong.find((t) => t >= 0) || 0);
  const dur = duration ?? Math.max(0, info.duration - s0);
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'audio.wav');
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(s0), '-t', String(dur), '-i', file,
    '-af', `afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, dur - 0.6)}:d=0.6`, '-ar', String(SR), '-ac', '2', out]);
  if (r.status !== 0) throw new Error('falha ao converter a trilha');
  const shift = (arr) => arr.map((t) => +(t - s0).toFixed(4)).filter((t) => t >= 0 && t <= dur);
  const res = { source: file, start: s0, duration: dur, bpm: info.bpm, spb: 60 / info.bpm, offset: shift(info.beats)[0] ?? 0,
    beats: shift(info.beats), bars: shift(info.strong), strong: shift(info.strong), accents: shift(info.accents) };
  writeFileSync(path.join(dir, 'beats.json'), JSON.stringify(res, null, 1));
  return res;
}

// ---------------------------------------------------------------- CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else opt._.push(argv[i]);
  }
  const dir = opt._[0];
  if (!dir && !opt.analyze) {
    console.log('Uso:\n  node lib/audio.mjs videos/<nome> --duration 8 --bpm 120 --style energetico|minimalista|cinematografico|lofi --events "0:impact,2:whoosh"\n  node lib/audio.mjs videos/<nome> --track audio/arquivo.mp3 [--duration 15] [--start 0]\n  node lib/audio.mjs --analyze audio/arquivo.mp3');
    process.exit(1);
  }
  if (opt.analyze || (!opt.track && /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(dir) && existsSync(dir))) {
    const r = await analyzeTrack(typeof opt.analyze === 'string' ? opt.analyze : dir);
    console.log(JSON.stringify({ ...r, beats: r.beats.slice(0, 16), note: 'beats truncado em 16' }, null, 1));
  } else if (opt.track) {
    const r = await prepareTrack(dir, opt.track, { duration: opt.duration && +opt.duration, start: opt.start && +opt.start });
    console.log(`✓ ${dir}/audio.wav · ${r.bpm} BPM · ${r.duration.toFixed(2)}s · ${r.strong.length} batidas fortes → beats.json`);
  } else {
    const events = String(opt.events || '').split(',').filter(Boolean).map((s) => {
      const [t, type, gain] = s.split(':'); return { t: +t, type, gain: gain ? +gain : undefined };
    });
    const t0 = Date.now();
    const g = makeAudio(dir, { duration: +(opt.duration || 15), bpm: +(opt.bpm || 120), style: opt.style || 'energetico', events, key: opt.key || 'A', seed: +(opt.seed || 1) });
    console.log(`✓ ${dir}/audio.wav · ${g.bpm} BPM · ${g.beats.length} batidas · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
