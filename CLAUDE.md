# azevedo-motion — regras da casa

Estúdio de motion graphics feito em código. Cada vídeo é `videos/<nome>/index.html` que expõe
`window.seek(t)`, `window.DURATION` e (opcional) `window.SCENES`, `window.POSTER_T`, `window.READY`.
O Chromium headless chama `seek(t)` frame a frame e o ffmpeg codifica. Veja `videos/teste-estudio/` como modelo.

## Início de sessão
- Se `node_modules/` faltar ou `node engine/bin.mjs` falhar → `bash scripts/setup.sh` antes de tudo.
- A máquina é descartável: só sobrevive o que for commitado e enviado. Commit + push a cada etapa concluída.
- Nada de apt/instalação global. Só dependências npm do projeto. Caminhos de ffmpeg/ffprobe/Chromium: `engine/bin.mjs`.

## Comandos
| comando | o que faz |
|---|---|
| `npm run preview -- videos/<n> --format all` | 30 fps, metade da resolução → `out/preview_*.mp4` (não commitado) |
| `npm run critique -- videos/<n> --frames 8 --format 16:9,9:16` | frames em `frames/` + `contact_sheet.png` |
| `npm run check -- videos/<n>` | prova que `seek(t)` é determinístico |
| `node videos/<n>/audio.mjs` ou `npm run audio -- videos/<n> --duration 15 --bpm 120 --style energetico --events "0:impact,2:whoosh"` | `audio.wav` + `beats.json` |
| `npm run audio -- videos/<n> --track audio/x.mp3 --duration 15` | usa trilha de `audio/`: mede BPM/batidas, corta num downbeat |
| `npm run render -- videos/<n> --fps 60 --format 16:9\|9:16\|1:1\|all` | `out/final_<formato>.mp4` + `poster.png` |

## Contrato do `index.html`
- `seek(t)` desenha o frame EXATO do instante t (segundos), a partir de qualquer estado anterior.
- Proibido: relógio (`Date.now`, `performance.now`), `requestAnimationFrame`, `setTimeout`, animações/transições CSS
  rodando sozinhas, `Math.random` sem semente (use `rng(seed)`/`hash()` de `lib/motion.js`). O motor congela tudo isso e avisa.
- Fontes só via `/node_modules/@fontsource/...` (sem rede no render). Meça texto só depois de `document.fonts.load(...)`.
- Imports: `/lib/motion.js`, `/lib/layout.js` (o servidor local serve a raiz do repo).

## Fluxo obrigatório
1. **Entender o pedido** (tema/produto, duração, formatos, tom). Acima de 30 s → `BRIEF.md` a partir de `templates/BRIEF.md`.
2. **Referência**: ler `refs/` (e `refs/style_guide.md`).
3. **Spec**: `videos/<n>/spec.xml` a partir de `templates/spec.xml` (lista de estados com tempos na grade de batidas).
4. **Stills** das cenas-chave (`npm run critique -- ... --at t1,t2,...`) e olhar.
5. **Versão completa** em preview.
6. **Crítica** (loop abaixo) até tudo 8+.
7. **Áudio** (`audio.mjs` do vídeo, eventos nos cortes) — a grade de batidas vem antes do código das cenas.
8. **Render final** nos formatos pedidos.
9. **Commit + push**.

## Proibido
- Texto centralizado em gradiente. Tudo entrando com fade. Logo genérico no final. Clip-art.

## Exigido
- Molas de `lib/motion.js` em TODO movimento: `snappy` (UI, pouco overshoot), `default` (cards, câmera),
  `heavy` (tipografia, logo, 3D — sem overshoot), `playful` (mascotes). `track()` para alvos que mudam várias vezes.
  Tipografia nunca usa `playful`/`default` com overshoot.
- Uma ideia por cena. Gancho nos 2 primeiros segundos (o frame 0 já tem algo acontecendo).
- Algo visual novo a cada 3–5 s. Cortes na batida (`beats(bpm, dur)` em `lib/motion.js` / `beats.json`).
- Tipografia forte e legível (mín. ~3u em 9:16 para texto de leitura).
- Layout relativo via `lib/layout.js` (`createLayout`, `pick`, `safe`, `fitText`): reenquadrar por formato, nunca recortar.
  9:16 respeita a área segura da interface de Reels/TikTok.

## Referências e marca
- Use o que houver em `refs/`: copie paleta, tipografia e textura — não o assunto.
- Vídeo de referência: extraia frames (`node_modules/ffmpeg-static/ffmpeg -i ref.mp4 -vf fps=2 refs/frames/%03d.png`)
  e descreva o ritmo cena a cena ANTES de codar.
- Portfólio/várias imagens: gere `refs/style_guide.md` antes (paleta hex, tipos, grid, textura, ritmo, o que evitar).
- Imagens enviadas na conversa: salve em `refs/`.
- URL de produto: tente baixar logo, cores, fontes e prints reais para `assets/<marca>/`. Se a rede bloquear,
  NÃO invente a marca: peça os arquivos ao usuário e continue com placeholders neutros até lá.

## Loop de crítica (OBRIGATÓRIO)
Após cada preview: `npm run critique`, **olhe** `contact_sheet.png` (e frames individuais em resolução cheia),
dê nota 0–10 e mostre a tabela:

| composição | legibilidade | hierarquia | ritmo | fidelidade à referência | parece feito por estúdio caro? |
|---|---|---|---|---|---|

Liste os 3 piores problemas, corrija, repita até tudo ser 8+. Registre as rodadas em `NOTES.md`.

## Segredos
Chaves de API (ex.: `ELEVENLABS_API_KEY` para voz) só como variáveis de ambiente do ambiente da nuvem.
Nunca no código, no chat ou em commit.

## Entrega de cada vídeo
`out/final_<formato>.mp4`, `poster.png`, `contact_sheet.png`, `NOTES.md` (+ `index.html`, `audio.mjs`, `audio.wav`, `spec.xml`).
Commite os finais (MP4 > 90 MB → re-render com `--crf 21` ou maior) e faça push. Previews e `frames/` são ignorados pelo git.
