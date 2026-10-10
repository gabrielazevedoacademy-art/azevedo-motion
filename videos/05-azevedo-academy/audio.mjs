// Trilha do 05-azevedo-academy: 120 BPM, energético, efeitos de interface nos cortes e ações (1 batida = 0,5 s).
import { makeAudio } from '../../lib/audio.mjs';
const b = (n) => n * 0.5; // batida → segundos
const events = [
  // 1. gancho
  { t: 0, type: 'impact', gain: 0.9 },
  { t: b(1), type: 'click', gain: 0.45, pitch: 1.2 },
  { t: b(2), type: 'riser', dur: 1, gain: 0.5 }, { t: b(2), type: 'hit', gain: 0.9 },        // COMPLEXO se encaixa
  { t: b(3), type: 'click', gain: 0.5 },
  // 2. o canal
  { t: b(6) - 0.02, type: 'whoosh', dur: 0.5 }, { t: b(6), type: 'hit', gain: 0.8 },
  { t: b(6) + 0.18, type: 'click', gain: 0.3, pitch: 1.5 }, { t: b(6) + 0.36, type: 'click', gain: 0.3, pitch: 1.3 },
  { t: b(7), type: 'click', gain: 0.35, pitch: 1.1 }, { t: b(7) + 0.25, type: 'click', gain: 0.3, pitch: 0.9 },
  { t: b(8), type: 'whoosh', dur: 0.35, gain: 0.35 },
  { t: b(9), type: 'impact', gain: 0.55 }, { t: b(9), type: 'click', gain: 0.6, pitch: 0.8 },  // foto travada
  { t: b(10), type: 'whoosh', dur: 0.6, gain: 0.45 },                                            // brilho no banner
  // 3. três vídeos
  { t: b(12) - 0.02, type: 'whoosh', dur: 0.5 }, { t: b(12), type: 'hit', gain: 0.8 },
  { t: b(14), type: 'click', gain: 1.1 },                                                        // clique vídeo 1
  { t: b(16), type: 'whoosh', dur: 0.45, gain: 0.8 }, { t: b(16), type: 'kick', gain: 0.6 },
  { t: b(18), type: 'click', gain: 1.1 },                                                        // clique vídeo 2
  { t: b(20), type: 'whoosh', dur: 0.45, gain: 0.8 }, { t: b(20), type: 'kick', gain: 0.6 },
  { t: b(22), type: 'click', gain: 1.1 },                                                        // clique vídeo 3
  // 4. o número
  { t: b(24) - 0.02, type: 'whoosh', dur: 0.5 }, { t: b(24), type: 'hit', gain: 0.8 },
  { t: b(25), type: 'click', gain: 0.5, pitch: 1.4 },
  ...[0, 1, 2, 3, 4, 5].map((k) => ({ t: 12.75 + k * 0.25, type: 'click', gain: 0.55 + k * 0.06, pitch: 0.9 + k * 0.08 })), // rolos travando
  { t: b(28), type: 'riser', dur: 1.25, gain: 0.6 }, { t: b(28), type: 'drop', gain: 0.9 }, { t: b(28), type: 'impact', gain: 0.7 },
  // 5. assinatura
  { t: b(32) - 0.02, type: 'whoosh', dur: 0.5 }, { t: b(32), type: 'hit', gain: 0.9 },
  { t: b(34), type: 'whoosh', dur: 0.4, gain: 0.3 },
  { t: b(36) - 0.4, type: 'riser', dur: 0.4, gain: 0.35 },
  { t: b(36), type: 'click', gain: 2.4, pitch: 0.75 }, { t: b(36), type: 'click', gain: 1.6, pitch: 1.35 }, // CLIQUE forte
  { t: b(36), type: 'hit', gain: 1.0 }, { t: b(36), type: 'impact', gain: 0.6 },
  { t: b(36) + 0.12, type: 'click', gain: 0.4, pitch: 1.8 }, { t: b(36) + 0.24, type: 'click', gain: 0.3, pitch: 2.1 },
];
makeAudio(new URL('.', import.meta.url).pathname, { duration: 20, bpm: 120, style: 'energetico', events, key: 'E', seed: 5 });
console.log('✓ audio.wav + beats.json');
