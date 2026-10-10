# azevedo-motion

Estúdio de motion graphics feito em código: HTML + molas → Chromium headless → ffmpeg → MP4 pronto para Instagram, TikTok e YouTube.

## Começar
```bash
bash scripts/setup.sh          # npm ci + Chromium + checagem do ffmpeg
```
No Claude Code: `/motion-reel <pedido>` faz tudo (spec → preview → crítica → áudio → render → commit).

## Na mão
```bash
npm run preview  -- videos/teste-estudio --format all      # rascunho rápido
npm run critique -- videos/teste-estudio --frames 8        # contact_sheet.png
node videos/teste-estudio/audio.mjs                        # trilha sintetizada
npm run render   -- videos/teste-estudio --fps 60 --format 16:9,9:16
```
Saída em `videos/<nome>/out/final_<formato>.mp4` + `poster.png`.

## Peças
| arquivo | papel |
|---|---|
| `engine/render.mjs` | renderizador (seek frame a frame → pipe → H.264) |
| `engine/critique.mjs` | frames + folha de contato |
| `engine/check.mjs` | teste de determinismo |
| `lib/motion.js` | molas em fórmula fechada, `track`, `stagger`, cores, `beats` |
| `lib/layout.js` | layout relativo 16:9 / 9:16 / 1:1 |
| `lib/audio.mjs` | trilha + efeitos em Node puro; análise de trilhas em `audio/` |
| `templates/` | `spec.xml` (lista de estados) e `BRIEF.md` |

Regras completas em [CLAUDE.md](CLAUDE.md). Coloque referências em `refs/`, logos em `assets/<marca>/`, músicas em `audio/`.
