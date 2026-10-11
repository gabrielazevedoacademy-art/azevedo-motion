// Edita a narração escolhida (voz.mp3 = teste B) SEM mexer nas palavras:
//  1) ajusta só os silêncios entre frases (pausa dramática depois de "rosto", respiro antes da assinatura,
//     pausas um pouco mais curtas onde sobrava ar), cortando no ponto mais silencioso de cada pausa;
//  2) acelera 2% (atempo, mantém o tom) para o anúncio fechar em 30 s com a assinatura segurando ≥ 2,5 s.
// Saídas: voz/voz_editada.wav (48 kHz mono) e ../tempos.js (palavras com os tempos finais, usado pelo
// index.html e pelo audio.mjs — uma única fonte de verdade).
// Uso: node videos/07-abertura-curso-influencer/voz/editar.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG } from '../../../engine/bin.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
export const LEAD = 0.20;   // silêncio antes da 1ª palavra (o sub-boom do gancho respira)
export const TEMPO = 1.02;  // aceleração leve
// pausa (s) desejada DEPOIS da palavra de índice i
const GAPS = { 12: 0.30, 17: 0.58, 23: 0.45, 32: 0.32, 53: 0.28, 70: 0.42 };

const meta = JSON.parse(readFileSync(join(DIR, 'voz.json'), 'utf8'));
const W = meta.words;
const dec = spawnSync(FFMPEG, ['-v', 'error', '-i', join(DIR, 'voz.mp3'), '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
const src = new Float32Array(dec.stdout.buffer.slice(dec.stdout.byteOffset, dec.stdout.byteOffset + dec.stdout.length));

// ponto mais silencioso (janela de 20 ms) dentro de [a, b]
function quietest(a, b) {
  const win = Math.round(0.02 * SR); let best = Infinity, at = (a + b) / 2;
  for (let s = Math.round(a * SR); s + win < Math.round(b * SR); s += 48) {
    let e = 0; for (let i = s; i < s + win; i++) e += src[i] * src[i];
    if (e < best) { best = e; at = (s + win / 2) / SR; }
  }
  return at;
}

// lista de edições: em cada pausa, no ponto silencioso, insere (+) ou remove (−) silêncio
const edits = [];
for (const [k, want] of Object.entries(GAPS)) {
  const i = +k, a = W[i].end, b = W[i + 1].start;
  const pad = Math.min(0.06, (b - a) / 4);          // não encosta nas palavras
  const at = quietest(a + pad, b - pad);
  edits.push({ at, delta: want - (b - a), after: W[i].w });
}
edits.sort((p, q) => p.at - q.at);

// monta o áudio editado (cortes com micro-crossfade de 8 ms)
const out = [];
const push = (arr) => { for (const v of arr) out.push(v); };
push(new Float32Array(Math.round((LEAD - W[0].start) * SR)));
let cur = 0;
const xf = Math.round(0.008 * SR);
for (const e of edits) {
  const s = Math.round(e.at * SR);
  push(src.subarray(cur, s));
  if (e.delta >= 0) { push(new Float32Array(Math.round(e.delta * SR))); cur = s; }
  else {
    const skip = Math.round(-e.delta * SR);
    // crossfade entre o fim antes do corte e o trecho depois dele
    for (let j = 0; j < xf; j++) { const p = j / xf; out[out.length - xf + j] = out[out.length - xf + j] * (1 - p) + src[s + skip - xf + j] * p; }
    cur = s + skip;
  }
}
push(src.subarray(cur));

// mapeia um tempo original → tempo final
export function remap(t) {
  let d = LEAD - W[0].start;
  for (const e of edits) if (t > e.at) d += e.delta;
  return (t + d) / TEMPO;
}

const raw = join(DIR, '_edit_raw.f32');
writeFileSync(raw, Buffer.from(new Float32Array(out).buffer));
const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', raw,
  '-af', `atempo=${TEMPO}`, '-ar', String(SR), '-c:a', 'pcm_s24le', join(DIR, 'voz_editada.wav')]);
if (r.status !== 0) throw new Error(r.stderr.toString());
spawnSync('rm', ['-f', raw]);

// frases (índices de palavras) para legendas e cenas
const SENTENCES = [[0, 12], [13, 17], [18, 23], [24, 53], [54, 70], [71, 75]];
const words = W.map((w, i) => ({ i, w: w.w, start: +remap(w.start).toFixed(3), end: +remap(w.end).toFixed(3) }));
const sentences = SENTENCES.map(([a, b]) => ({ a, b, start: words[a].start, end: words[b].end, text: W.slice(a, b + 1).map((w) => w.w).join(' ') }));
const js = `// GERADO por voz/editar.mjs — não editar à mão. Tempos finais (s) da narração editada (voz_editada.wav).
export const VOICE_LEAD = ${LEAD};
export const VOICE_TEMPO = ${TEMPO};
export const WORDS = ${JSON.stringify(words)};
export const SENTENCES = ${JSON.stringify(sentences, null, 1)};
export const VOICE_END = ${words.at(-1).end};
`;
writeFileSync(join(DIR, '..', 'tempos.js'), js);
for (const e of edits) console.log(`pausa após "${e.after}" ${e.delta >= 0 ? '+' : ''}${e.delta.toFixed(2)} s`);
for (const s of sentences) console.log(`${s.start.toFixed(2)}–${s.end.toFixed(2)}  ${s.text}`);
