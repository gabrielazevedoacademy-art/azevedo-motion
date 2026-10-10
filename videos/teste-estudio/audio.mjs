// Trilha do teste-estudio: 120 BPM, energético, efeitos sincronizados aos cortes (1 compasso = 2 s).
import { makeAudio } from '../../lib/audio.mjs';
const b = (n) => n * 0.5; // batida → segundos
const events = [
  { t: 0, type: 'impact', gain: 0.8 },
  { t: b(1), type: 'click', gain: 0.5 }, { t: b(2), type: 'click', gain: 0.5 },
  { t: b(4), type: 'riser', dur: 0.5, gain: 0.8 }, { t: b(4), type: 'hit' },            // corte → morph
  { t: b(5), type: 'click' }, { t: b(6), type: 'click' }, { t: b(7), type: 'click' },  // cliques do cursor
  { t: b(8) - 0.02, type: 'whoosh', dur: 0.5 }, { t: b(8), type: 'hit', gain: 0.8 },  // corte → câmera
  { t: b(9), type: 'whoosh', dur: 0.4, gain: 0.4 }, { t: b(10), type: 'whoosh', dur: 0.4, gain: 0.4 }, { t: b(11), type: 'whoosh', dur: 0.4, gain: 0.5 },
  { t: b(12), type: 'riser', dur: 1, gain: 0.7 }, { t: b(12), type: 'impact' },        // corte → partículas
  { t: b(14), type: 'drop' }, { t: b(14), type: 'hit', gain: 0.7 },                    // onda de choque
];
makeAudio(new URL('.', import.meta.url).pathname, { duration: 8, bpm: 120, style: 'energetico', events, key: 'A', seed: 3 });
console.log('✓ audio.wav + beats.json');
