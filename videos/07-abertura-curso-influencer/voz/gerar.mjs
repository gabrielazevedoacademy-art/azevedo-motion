// Gera a narração na ElevenLabs (voz Liam, eleven_multilingual_v2) com timestamps por palavra.
// Uso: node videos/07-abertura-curso-influencer/voz/gerar.mjs [teste|<variante>]
// A chave vem SÓ de process.env.ELEVENLABS_API_KEY — nunca é impressa nem salva.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('ELEVENLABS_API_KEY não definida'); process.exit(1); }

const VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ'; // Liam
const MODEL = 'eleven_multilingual_v2';
const SEED = 707;

// Texto EXATO do roteiro (não alterar uma palavra).
export const TEXT = [
  'Sabe aqueles perfis que crescem rápido, fecham com marca e vendem todo dia?',
  'Muitos nem mostram o rosto.',
  'O que eles têm é estratégia.',
  'No Influencer com IA, eu te mostro do zero: quem é o seu público, qual é a cara do seu perfil e como criar imagem e vídeo com inteligência artificial.',
  'E, principalmente, como transformar isso em renda: TikTok Shop, parceria com marca e o seu próprio produto.',
  'O link tá na descrição.',
].join('\n');

export const VARIANTES = {
  'A-calma':       { stability: 0.62, similarity_boost: 0.80, style: 0.05, use_speaker_boost: true, speed: 1.00 },
  'B-equilibrada': { stability: 0.50, similarity_boost: 0.80, style: 0.15, use_speaker_boost: true, speed: 1.05 },
  'C-firme':       { stability: 0.40, similarity_boost: 0.85, style: 0.30, use_speaker_boost: true, speed: 1.08 },
};

// Converte o alinhamento por caractere em palavras {w, start, end}.
function words(al) {
  const out = []; let cur = null;
  al.characters.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) { out.push(cur); cur = null; } return; }
    if (!cur) cur = { w: '', start: al.character_start_times_seconds[i], end: 0 };
    cur.w += c; cur.end = al.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out;
}

async function gerar(nome, settings, prefixo) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: TEXT, model_id: MODEL, voice_settings: settings, seed: SEED }),
  });
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const mp3 = join(DIR, `${prefixo}.mp3`);
  writeFileSync(mp3, Buffer.from(j.audio_base64, 'base64'));
  const ws = words(j.normalized_alignment || j.alignment);
  const dur = ws.at(-1).end;
  writeFileSync(join(DIR, `${prefixo}.json`), JSON.stringify({ voice: 'Liam', voice_id: VOICE_ID, model: MODEL, seed: SEED, settings, duration: dur, words: ws }, null, 1));
  console.log(`${prefixo}.mp3  ${dur.toFixed(2)} s  (${ws.length} palavras)`);
}

const arg = process.argv[2] || 'teste';
if (arg === 'teste') {
  for (const [n, s] of Object.entries(VARIANTES)) await gerar(n, s, `teste_${n}`);
} else {
  const s = VARIANTES[arg]; if (!s) throw new Error('variante desconhecida: ' + arg);
  await gerar(arg, s, 'voz');
}
