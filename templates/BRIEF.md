# BRIEF — <nome do vídeo>

> Briefing de diretor. Obrigatório para vídeos acima de 30 s. Copie para `videos/<nome>/BRIEF.md` e preencha antes de codar.

## 1. Filme em uma linha
<O que o espectador sente/entende em uma frase. Ex.: "Um cursor monta o app inteiro em 20 s, no ritmo da música.">

## 2. Referências
| referência | manter | exagerar |
|---|---|---|
| refs/<arquivo> | paleta, textura de grão | contraste de escala na tipografia |
| refs/style_guide.md | grid de 12 colunas | — |

Ritmo da referência (se for vídeo), cena a cena: `0–2 s gancho …`, `2–5 s …`

## 3. Ferramentas e chaves
- Motor: `engine/render.mjs` (60 fps), `lib/motion.js`, `lib/layout.js`, `lib/audio.mjs`.
- Áudio: sintetizado (<estilo>, <bpm> BPM) | trilha `audio/<arquivo>`.
- Voz: `ELEVENLABS_API_KEY` (variável de ambiente da nuvem — nunca no código/chat/commit) | sem voz.
- Assets de marca: `assets/<marca>/` (origem: site oficial | enviados pelo usuário | placeholders neutros).

## 4. Bíblia do personagem / elemento-herói
- Quem/o quê: <cursor, mascote, forma, produto>
- Silhueta e proporções: <…>
- Cores (hex): <…>
- Como se move: <preset de mola, o que nunca faz>
- Expressões/estados: <neutro, clicando, comemorando…>

## 5. Roteiro de batidas
BPM: <120> · 1 batida = <0,5 s> · 1 compasso = <2 s>

| tempo | batida | cena / ação | texto na tela | som |
|---|---|---|---|---|
| 0,0–2,0 | 1–4 | gancho: … | "…" | impact em 0 |
| 2,0–6,0 | 5–12 | … | … | whoosh 1,95 / hit 2,0 |
| … | … | … | … | … |

Regras: gancho nos 2 primeiros segundos; algo visual novo a cada 3–5 s; cortes na batida; uma ideia por cena.

## 6. Texto na tela
| # | texto exato | cena | tipo/tamanho | formato 9:16 |
|---|---|---|---|---|
| 1 | | | | |

## 7. Etapas obrigatórias
- [ ] **Plano**: spec.xml com lista de estados (`templates/spec.xml`)
- [ ] **Rig**: elementos-herói construídos e parametrizados (posições via layout, estados via track)
- [ ] **Stills**: cenas-chave em 16:9 e 9:16 (`npm run critique -- … --at …`) aprovadas no loop
- [ ] **Animatic**: preview com tempos e cortes certos, sem polimento
- [ ] **Versão completa**: preview de tudo
- [ ] **Polimento**: textura, microanimações, transições, HUD
- [ ] **Áudio**: trilha + efeitos nos cortes (`audio.mjs`)
- [ ] **Render**: finais nos formatos pedidos, `npm run check` verde

## 8. Loop de crítica
Após cada preview: contact sheet → notas 0–10 → 3 piores problemas → corrigir → repetir até tudo ser 8+.

| rodada | composição | legibilidade | hierarquia | ritmo | fidelidade | estúdio caro | correções |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |

## 9. Entregáveis
- `out/final_16x9.mp4`, `out/final_9x16.mp4`, `out/final_1x1.mp4` (os pedidos)
- `poster.png`, `contact_sheet.png`, `NOTES.md`
- Commit + push na `main` (ou PR aberto para `main`)
