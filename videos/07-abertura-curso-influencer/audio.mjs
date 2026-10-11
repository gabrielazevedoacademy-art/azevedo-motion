// Trilha + efeitos + mix do 07-abertura-curso-influencer.
// Trilha original sintetizada (87,05 BPM, Ré menor): pads quentes, cordas sintéticas, piano grave, sub e pulso lento.
// Efeitos GRAVES (nada acima de ~2 kHz): sub-boom, whoosh filtrado, virada de página, clique abafado, riser grave.
// Ducking: a música abaixa ~12 dB sob a voz (envelope medido na voz editada) e sobe nas pausas e no final.
// Mix final: voz na frente, −14 LUFS integrados, pico ≤ −1 dBTP (loudnorm em 2 passadas).
// Uso: node videos/07-abertura-curso-influencer/audio.mjs
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG } from '../../engine/bin.mjs';
import { writeWav } from '../../lib/audio.mjs';
import { WORDS } from './tempos.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const SR = 48000, TAU = Math.PI * 2;
const DUR = 30;
const N = Math.ceil((DUR + 0.5) * SR);
const wt = (i) => WORDS[i].start, we = (i) => WORDS[i].end;

// ------------------------------------------------------------------ grade (mesma do index.html)
const SPB = (wt(71) - wt(23)) / 28;            // 0,6893 s → 87,05 BPM
const BAR = SPB * 4;
const OFFSET = wt(23) - 12 * SPB;              // downbeat em "estratégia" e na assinatura
const beatT = (n) => OFFSET + n * SPB;

// ------------------------------------------------------------------ util
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296 * 2 - 1; }; }
const rnd = rng(707);
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const lpA = (fc) => 1 - Math.exp(-TAU * Math.min(fc, SR * 0.45) / SR);
class Bus { constructor() { this.L = new Float32Array(N); this.R = new Float32Array(N); }
  add(i, v, pan = 0) { if (i < 0 || i >= N) return; const a = (pan + 1) * Math.PI / 4; this.L[i] += v * Math.cos(a) * 1.414; this.R[i] += v * Math.sin(a) * 1.414; } }
// biquad (RBJ) — usado para band-pass/low-pass com corte variável
function biquad(type) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, fc, q = 0.7) => {
    const w = TAU * Math.min(fc, SR * 0.45) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
  };
}

const music = new Bus(), verb = new Bus(), sfx = new Bus(), sfxVerb = new Bus();

// ------------------------------------------------------------------ instrumentos
function pad(bus, t, notes, { dur, gain = 1, cutoff = 1200, attack = 0.8, release = 1.2, detune = 0.1, vib = 0 }) {
  const s = Math.round(t * SR), n = Math.round((dur + release) * SR);
  const vs = []; for (const nt of notes) for (const d of [-detune, 0, detune]) vs.push({ f: midi(nt + d), ph: (rnd() + 1) / 2, pan: d * 5, a: 0, b: 0 });
  const a = lpA(cutoff);
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    const env = Math.min(1, tt / attack) ** 1.5 * (tt < dur ? 1 : Math.exp(-(tt - dur) * 4 / release));
    const vm = 1 + vib * Math.sin(TAU * 4.8 * tt) * Math.min(1, tt / 1.5);
    for (const v of vs) {
      v.ph = (v.ph + v.f * vm / SR) % 1; const raw = 2 * v.ph - 1;
      v.a += a * (raw - v.a); v.b += a * (v.a - v.b);
      bus.add(s + i, v.b * env * 0.06 * gain / Math.sqrt(notes.length), v.pan);
    }
  }
}
function piano(bus, t, note, { gain = 1, len = 3.2 } = {}) {
  const s = Math.round(t * SR), n = Math.round(len * SR), f = midi(note);
  const parts = [1, 2, 3, 4, 5, 6].map((h) => ({ f: f * h * (1 + 0.0004 * h * h), amp: 1 / h ** 1.6, dec: 0.9 + h * 0.9 }));
  let hn = 0; const lp = biquad('lp');
  for (let i = 0; i < n; i++) {
    const tt = i / SR; let v = 0;
    for (const p of parts) v += Math.sin(TAU * p.f * tt) * p.amp * Math.exp(-tt * p.dec);
    hn = lp(rnd(), 900) * Math.exp(-tt * 60) * 0.25;   // martelo abafado
    const env = Math.min(1, i / 90);
    bus.add(s + i, (v * 0.22 + hn) * env * gain, (note - 50) / 60);
  }
}
function sub(bus, t, note, { dur, gain = 1, attack = 0.25 }) {
  const s = Math.round(t * SR), n = Math.round((dur + 0.6) * SR), f = midi(note); let ph = 0;
  for (let i = 0; i < n; i++) { const tt = i / SR; ph += TAU * f / SR;
    const env = Math.min(1, tt / attack) * (tt < dur ? 1 : Math.exp(-(tt - dur) * 7));
    bus.add(s + i, Math.sin(ph) * env * 0.32 * gain); }
}
function pulse(bus, t, { gain = 1 } = {}) {            // batimento grave e macio
  const s = Math.round(t * SR), n = Math.round(0.42 * SR); let ph = 0;
  for (let i = 0; i < n; i++) { const tt = i / SR; ph += TAU * (44 + 30 * Math.exp(-tt * 30)) / SR;
    bus.add(s + i, Math.tanh(Math.sin(ph) * 1.3) * Math.exp(-tt * 9) * Math.min(1, i / 60) * 0.45 * gain); }
}
// --- efeitos
function subBoom(t, { gain = 1 } = {}) {
  const s = Math.round(t * SR), n = Math.round(2.6 * SR); let ph = 0; const lp = biquad('lp');
  for (let i = 0; i < n; i++) { const tt = i / SR;
    ph += TAU * (28 + 34 * Math.exp(-tt * 5)) / SR;
    const body = Math.tanh(Math.sin(ph) * Math.exp(-tt * 1.5) * 1.8);
    const thump = lp(rnd(), 160) * Math.exp(-tt * 14) * 2.2;
    const v = (body * 0.85 + thump) * Math.min(1, i / 40) * gain;
    sfx.add(s + i, v); sfxVerb.add(s + i, v * 0.35); }
}
function lowHit(t, { gain = 1 } = {}) {                // "dun" grave curto (pausa dramática / renda)
  const s = Math.round(t * SR), n = Math.round(1.6 * SR); let ph = 0;
  for (let i = 0; i < n; i++) { const tt = i / SR; ph += TAU * (41 + 18 * Math.exp(-tt * 9)) / SR;
    const v = Math.sin(ph) * Math.exp(-tt * 2.6) * Math.min(1, i / 50) * 0.8 * gain; sfx.add(s + i, v); sfxVerb.add(s + i, v * 0.4); }
}
function whoosh(t, { dur = 0.7, gain = 1, hi = 1300 } = {}) {   // centrado em t; ruído com banda que sobe e desce (< 2 kHz)
  const s = Math.round((t - dur * 0.55) * SR), n = Math.round(dur * SR); const bp = biquad('bp'), lp = biquad('lp');
  for (let i = 0; i < n; i++) { const p = i / n;
    const fc = 180 + (hi - 180) * Math.sin(Math.PI * p) ** 2;
    const env = Math.sin(Math.PI * Math.min(1, p < 0.55 ? p / 0.55 * 0.5 : 0.5 + (p - 0.55) / 0.45 * 0.5)) ** 1.6;
    const v = lp(bp(rnd(), fc, 0.9), 1900) * env * 1.6 * gain;
    sfx.add(s + i, v, -0.7 + 1.4 * p); sfxVerb.add(s + i, v * 0.3); }
}
function pageTurn(t, { gain = 1 } = {}) {               // folha com corpo: tremulação filtrada + baque grave
  const s = Math.round((t - 0.22) * SR), n = Math.round(0.6 * SR); const lp = biquad('lp'), lp2 = biquad('lp'); let ph = 0;
  for (let i = 0; i < n; i++) { const tt = i / SR, p = i / n;
    const flutter = 0.55 + 0.45 * Math.sin(TAU * (34 - 18 * p) * tt);
    const env = Math.sin(Math.PI * Math.min(1, p * 1.25)) ** 1.3;
    const paper = lp(rnd(), 900 + 900 * Math.sin(Math.PI * p)) * flutter * env * 1.25;
    const tb = tt - 0.22; let body = 0;
    if (tb > 0) { ph += TAU * (70 + 40 * Math.exp(-tb * 25)) / SR; body = Math.sin(ph) * Math.exp(-tb * 16) * 0.5 + lp2(rnd(), 300) * Math.exp(-tb * 30) * 0.8; }
    const v = (paper + body) * gain; sfx.add(s + i, v, 0.5 - p); sfxVerb.add(s + i, v * 0.25); }
}
function clickLow(t, { gain = 1 } = {}) {               // clique de cursor abafado
  const s = Math.round(t * SR), n = Math.round(0.09 * SR); const lp = biquad('lp'); let ph = 0;
  for (let i = 0; i < n; i++) { const tt = i / SR; ph += TAU * (210 - 600 * tt) / SR;
    const v = (Math.sin(ph) * Math.exp(-tt * 55) * 0.7 + lp(rnd(), 700) * Math.exp(-tt * 120) * 0.8) * gain; sfx.add(s + i, v, 0.15); }
}
function thump(t, { gain = 1 } = {}) {                  // papel pousando
  const s = Math.round(t * SR), n = Math.round(0.35 * SR); const lp = biquad('lp'); let ph = 0;
  for (let i = 0; i < n; i++) { const tt = i / SR; ph += TAU * (95 + 60 * Math.exp(-tt * 30)) / SR;
    const v = (Math.sin(ph) * Math.exp(-tt * 18) * 0.6 + lp(rnd(), 500) * Math.exp(-tt * 40) * 0.7) * gain; sfx.add(s + i, v); sfxVerb.add(s + i, v * 0.2); }
}
function riserLow(tEnd, { dur = 0.55, gain = 1 } = {}) {
  const s = Math.round((tEnd - dur) * SR), n = Math.round(dur * SR); const lp = biquad('lp'); let ph = 0;
  for (let i = 0; i < n; i++) { const p = i / n; ph += TAU * (38 + 50 * p * p) / SR;
    const v = (lp(rnd(), 150 + 1300 * p * p) * 1.4 + Math.sin(ph) * 0.5) * p ** 2.2 * gain; sfx.add(s + i, v); sfxVerb.add(s + i, v * 0.4); }
}

// ------------------------------------------------------------------ arranjo
// Ré menor: Dm(add9) – Bbmaj7 – Fmaj7 – C(add9), um acorde por compasso
const CH = [
  { root: 38, notes: [50, 53, 57, 64] },  // Dm add9  (D3 F3 A3 E4)
  { root: 34, notes: [50, 53, 57, 58] },  // Bbmaj7/D
  { root: 41, notes: [48, 53, 57, 60] },  // Fmaj7
  { root: 36, notes: [48, 52, 55, 62] },  // Cadd9
];
const silentFrom = we(17) + 0.02, silentTo = wt(18) - 0.15;    // pausa dramática depois de "rosto"
for (let bar = -1; bar < 12; bar++) {
  const t0 = OFFSET + bar * BAR; if (t0 > DUR) break;
  const c = CH[((bar % 4) + 4) % 4];
  const tA = Math.max(0, t0);
  const end = Math.min(t0 + BAR, DUR);
  const intro = t0 < 4.6, verse = t0 >= 8.0 && t0 < 26.5;
  const finalBar = Math.abs(t0 - wt(71)) < 0.01;
  if (finalBar) continue; // o acorde final é tratado abaixo
  // segura a pausa dramática: o compasso que a contém corta antes dela
  const cut = t0 < silentTo && t0 + BAR > silentFrom ? silentFrom - tA : end - tA;
  if (cut <= 0.05) continue;
  const lift = t0 >= 19.5 ? 1.25 : 1;
  pad(music, tA, c.notes, { dur: cut, gain: (intro ? 0.85 : 1.0) * lift, cutoff: intro ? 900 : 1300, attack: tA === 0 ? 0.05 : 0.6 });
  pad(verb, tA, c.notes, { dur: cut, gain: 0.7, cutoff: 1100, attack: 0.6 });
  sub(music, tA, c.root - 12, { dur: cut, gain: verse ? 1 : 0.8, attack: tA === 0 ? 0.02 : 0.25 });
  if (verse || t0 >= 26.5) pad(music, tA, c.notes.map((x) => x + 12), { dur: cut, gain: 0.35 * lift, cutoff: 1700, attack: 1.2, vib: 0.003 }); // cordas
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * SPB; if (tb < 0 || tb > tA + cut - 0.05) continue;
    if (intro || verse) pulse(music, tb, { gain: verse ? (b % 2 ? 0.55 : 0.85) : (b % 2 ? 0 : 0.6) });
    // piano grave: fundamental e quinta, dobrando por batida no verso
    if (b % 2 === 0 || verse) piano(music, tb, (b % 2 ? c.root + 19 : c.root + 12), { gain: verse ? 0.8 : 0.95 });
  }
}
// retorno depois da pausa: pad entra com a frase "O que eles têm é" e cresce até "estratégia"
pad(music, wt(18) - 0.1, CH[2].notes, { dur: wt(23) - wt(18) + 0.1, gain: 0.7, cutoff: 800, attack: 0.9 });
// drone grave que segura a pausa dramática (quase nada)
sub(music, silentFrom - 0.1, 26, { dur: silentTo - silentFrom + 0.3, gain: 0.35, attack: 0.3 });
// acorde final: sobe no fim e respira até 30 s
{ const t0 = wt(71), c = { root: 38, notes: [50, 53, 57, 62, 64] };
  pad(music, t0, c.notes, { dur: DUR - t0 - 0.6, gain: 1.3, cutoff: 1500, attack: 0.25, release: 1.5 });
  pad(verb, t0, c.notes, { dur: DUR - t0 - 0.6, gain: 1.0, cutoff: 1300, attack: 0.25 });
  pad(music, t0, c.notes.map((x) => x + 12), { dur: DUR - t0 - 0.6, gain: 0.45, cutoff: 1800, attack: 0.6, vib: 0.003 });
  sub(music, t0, 26, { dur: DUR - t0 - 0.5, gain: 1.1, attack: 0.02 });
  for (const [k, nt] of [38 + 12, 45 + 12, 50 + 12].entries()) piano(music, t0 + k * 0.05, nt, { gain: 0.9, len: 2.6 }); }

// ------------------------------------------------------------------ efeitos (nos cortes, fora das palavras importantes)
const EV = [];
const ev = (t, type, f, opts) => { EV.push({ t: +t.toFixed(3), type }); f(t, opts); };
ev(0.0, 'sub-boom', subBoom, { gain: 0.9 });                                  // gancho
ev(0.62, 'thump', thump, { gain: 0.35 }); ev(0.86, 'thump', thump, { gain: 0.3 }); ev(1.1, 'thump', thump, { gain: 0.28 }); // páginas pousando
ev((we(12) + wt(13)) / 2 - 0.02, 'whoosh', whoosh, { dur: 0.75, gain: 0.85 }); // câmera entra na foto 01
ev(we(17) + 0.02, 'low-hit', lowHit, { gain: 0.9 });                          // pausa dramática
ev(wt(18) - 0.18, 'whoosh', whoosh, { dur: 0.6, gain: 0.55, hi: 900 });       // silhueta sai
ev(wt(23), 'sub-boom', subBoom, { gain: 1.0 });                               // ESTRATÉGIA
ev(9.40, 'page-turn', pageTurn, { gain: 0.9 });
ev(12.80, 'page-turn', pageTurn, { gain: 0.85 });
ev(14.27, 'page-turn', pageTurn, { gain: 0.8 });
for (const t of [14.70, 15.00, 15.29]) ev(t, 'click', clickLow, { gain: 0.55 }); // cursor colhe 3 cores
ev(15.82, 'click', clickLow, { gain: 0.55 });                                 // escolhe a tipografia
ev(15.91, 'page-turn', pageTurn, { gain: 0.8 });
ev(wt(48), 'thump', thump, { gain: 0.45 }); ev(wt(50), 'thump', thump, { gain: 0.45 });   // imagem / vídeo entram nos quadros
ev(wt(52) - 0.05, 'whoosh', whoosh, { dur: 0.5, gain: 0.35, hi: 800 });       // miniaturas preenchem o grid
ev((we(53) + wt(54)) / 2, 'whoosh', whoosh, { dur: 0.7, gain: 0.8 });         // página de renda
ev(wt(60), 'low-hit', lowHit, { gain: 0.55 });                                // "renda"
ev((we(60) + wt(61)) / 2, 'whoosh', whoosh, { dur: 0.45, gain: 0.45, hi: 900 });
ev(we(62) + 0.03, 'click', clickLow, { gain: 0.6 });                          // clique na garrafa (TikTok Shop)
ev(wt(63) - 0.08, 'whoosh', whoosh, { dur: 0.4, gain: 0.35, hi: 800 });        // parceria
ev(wt(69), 'thump', thump, { gain: 0.45 });                                   // capa do produto
ev(wt(71), 'riser', riserLow, { dur: wt(71) - we(70) + 0.12, gain: 0.8 });     // riser grave curto antes da assinatura
ev(wt(71), 'sub-boom', subBoom, { gain: 0.95 });                              // assinatura

// ------------------------------------------------------------------ reverb simples (Schroeder)
function reverb(bus, { size = 0.84, damp = 0.4, amt = 0.14 } = {}) {
  const out = new Bus();
  for (const [src, dst, sp] of [[bus.L, out.L, 0], [bus.R, out.R, 23]]) {
    const acc = new Float32Array(N);
    for (const c of [1557, 1617, 1491, 1422]) { const d = Math.round((c + sp) * SR / 44100), buf = new Float32Array(d); let k = 0, lp = 0;
      for (let i = 0; i < N; i++) { const y = buf[k]; lp = y * (1 - damp) + lp * damp; buf[k] = src[i] + lp * size; acc[i] += y; k = (k + 1) % d; } }
    let sig = acc;
    for (const a of [225, 556]) { const d = Math.round((a + sp) * SR / 44100), buf = new Float32Array(d); let k = 0; const o = new Float32Array(N);
      for (let i = 0; i < N; i++) { const b = buf[k], x = sig[i]; o[i] = -x + b; buf[k] = x + b * 0.5; k = (k + 1) % d; } sig = o; }
    for (let i = 0; i < N; i++) dst[i] = sig[i] * amt;
  }
  return out;
}
const mv = reverb(verb, { amt: 0.16 }), sv = reverb(sfxVerb, { amt: 0.12, size: 0.8 });

// ------------------------------------------------------------------ ducking pela voz
const VOICE = join(DIR, 'voz', 'voz_editada.wav');
const dec = spawnSync(FFMPEG, ['-v', 'error', '-i', VOICE, '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
const voice = new Float32Array(dec.stdout.buffer.slice(dec.stdout.byteOffset, dec.stdout.byteOffset + dec.stdout.length));
const duck = new Float32Array(N).fill(1);
{
  const DEPTH = 10 ** (-12 / 20);
  const win = Math.round(0.03 * SR); let env = 0;
  const att = 1 - Math.exp(-1 / (0.04 * SR)), rel = 1 - Math.exp(-1 / (0.35 * SR));
  // envelope do "há fala": RMS > −38 dBFS, com antecipação de 60 ms para a música já estar baixa na 1ª sílaba
  const look = Math.round(0.06 * SR);
  const act = new Float32Array(N);
  let acc = 0; for (let i = 0; i < N; i++) { const v = voice[i] || 0; acc += v * v; if (i >= win) { const o = voice[i - win] || 0; acc -= o * o; } act[i] = Math.sqrt(Math.max(0, acc) / win) > 0.0126 ? 1 : 0; }
  for (let i = 0; i < N; i++) { const target = act[Math.min(N - 1, i + look)] ? 1 : 0; env += (target > env ? att : rel) * (target - env); duck[i] = 1 - (1 - DEPTH) * env; }
}

// ------------------------------------------------------------------ stems
const L = Math.round(DUR * SR);
const mus = { L: new Float32Array(L), R: new Float32Array(L) }, fx = { L: new Float32Array(L), R: new Float32Array(L) };
const fadeOut = (i) => { const t = i / SR; return t > DUR - 1.2 ? Math.max(0, (DUR - t) / 1.2) ** 1.5 : 1; };
for (let i = 0; i < L; i++) {
  const f = fadeOut(i), fi = Math.min(1, i / 48);
  mus.L[i] = (music.L[i] + mv.L[i]) * duck[i] * f * fi; mus.R[i] = (music.R[i] + mv.R[i]) * duck[i] * f * fi;
  fx.L[i] = (sfx.L[i] + sv.L[i]) * f * fi; fx.R[i] = (sfx.R[i] + sv.R[i]) * f * fi;
}
const norm = (st, peak) => { let m = 0; for (let i = 0; i < L; i++) m = Math.max(m, Math.abs(st.L[i]), Math.abs(st.R[i])); const g = peak / m; for (let i = 0; i < L; i++) { st.L[i] *= g; st.R[i] *= g; } };
norm(mus, 0.5); norm(fx, 0.5);
const tmpM = join(DIR, '_musica.wav'), tmpF = join(DIR, '_efeitos.wav');
writeWav(tmpM, { ...mus, sampleRate: SR }); writeWav(tmpF, { ...fx, sampleRate: SR });

// ------------------------------------------------------------------ mix (ffmpeg): voz tratada + música + efeitos → loudnorm 2 passadas
// níveis relativos medidos em LUFS: voz como referência, música ~12 dB abaixo nos trechos falados (já com ducking),
// efeitos ~10 dB abaixo da voz.
function lufs(file, filter = 'anull') {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', `${filter},ebur128=peak=true`, '-f', 'null', '-'], { encoding: 'utf8' });
  const sum = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const m = sum.match(/I:\s+(-?[\d.]+) LUFS[\s\S]*?Peak:\s+(-?[\d.]+) dBFS/);
  return m ? { I: +m[1], peak: +m[2] } : null;
}
const VOICE_CHAIN = 'highpass=f=75,lowshelf=f=180:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.5,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=140:makeup=2';
const lv = lufs(VOICE, VOICE_CHAIN), lm = lufs(tmpM), lf = lufs(tmpF);
// alvo pré-mix: voz −17 LUFS; música (média com ducking) −29; efeitos −27 (integrado do stem esparso)
const gV = -17 - lv.I, gM = -29.5 - lm.I, gF = -27 - lf.I;
const pre = join(DIR, '_premix.wav');
const mix = spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', VOICE, '-i', tmpM, '-i', tmpF, '-filter_complex',
  `[0:a]${VOICE_CHAIN},volume=${gV.toFixed(2)}dB,adelay=0|0,aformat=channel_layouts=stereo,apad=whole_dur=${DUR}[v];` +
  `[1:a]volume=${gM.toFixed(2)}dB[m];[2:a]volume=${gF.toFixed(2)}dB[f];` +
  `[v][m][f]amix=inputs=3:normalize=0:duration=longest,atrim=0:${DUR}[o]`, '-map', '[o]', '-ar', String(SR), '-c:a', 'pcm_f32le', pre]);
if (mix.status !== 0) throw new Error(mix.stderr?.toString());
// loudnorm 2 passadas → −14 LUFS, −1,5 dBTP (margem para o AAC ficar ≤ −1 dBTP)
const p1 = spawnSync(FFMPEG, ['-hide_banner', '-i', pre, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const js = JSON.parse(p1.stderr.slice(p1.stderr.lastIndexOf('{'), p1.stderr.lastIndexOf('}') + 1));
const out = join(DIR, 'audio.wav');
const p2 = spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', pre, '-af',
  `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true,alimiter=limit=0.83:attack=1:release=60:level=false`,
  '-ar', String(SR), '-c:a', 'pcm_s16le', out]);
if (p2.status !== 0) throw new Error(p2.stderr?.toString());
for (const f of [tmpM, tmpF, pre]) unlinkSync(f);

writeFileSync(join(DIR, 'beats.json'), JSON.stringify({
  source: 'sintetizado (audio.mjs)', bpm: +(60 / SPB).toFixed(3), spb: SPB, offset: OFFSET, bar: BAR,
  beats: Array.from({ length: 48 }, (_, n) => +beatT(n).toFixed(4)).filter((t) => t >= 0 && t <= DUR),
  bars: Array.from({ length: 13 }, (_, n) => +(OFFSET + n * BAR).toFixed(4)).filter((t) => t >= 0 && t <= DUR),
  events: EV,
}, null, 1));
const fin = lufs(out);
console.log(`✓ audio.wav · ${(60 / SPB).toFixed(2)} BPM · ${EV.length} efeitos · ${fin.I} LUFS · pico ${fin.peak} dBFS`);
console.log(`  níveis pré-mix: voz ${lv.I} → −17 · música ${lm.I} → −29,5 · efeitos ${lf.I} → −27`);
