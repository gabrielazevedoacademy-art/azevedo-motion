---
name: motion-reel
description: Cria um vídeo de motion graphics profissional (MP4 16:9/9:16/1:1, 60 fps, com trilha) a partir de uma frase ou briefing, usando o estúdio em código deste repositório. Use quando o usuário digitar /motion-reel ou pedir um reel, vídeo animado, motion graphics, vinheta, showreel ou vídeo de produto.
---

# /motion-reel

Exemplos de entrada:
- `/motion-reel para https://meusite.com, 20s, vertical, referência refs/frame.png`
- `/motion-reel lançamento do curso de fotografia, 15s, 9:16 e 16:9, energético`
- um briefing livre em texto

Siga **CLAUDE.md** à risca. Este é o roteiro de execução.

## 0. Setup
- `node engine/bin.mjs` — se falhar ou faltar `node_modules/`, rode `bash scripts/setup.sh`.
- Se o setup disser que não há Chromium, pare e informe ao usuário o domínio a liberar (mensagem do script).

## 1. Entender o pedido
Extraia: **tema/produto**, **duração**, **formato(s)**, tom/estilo, referência, URL, texto obrigatório.
- Se faltar o essencial (tema/produto, duração ou formato) e não der para inferir, pergunte **UMA vez**, numa única
  mensagem objetiva com as três perguntas e os padrões propostos.
- Se o usuário não responder ou disser "tanto faz": **15 s**, **16:9**, estilo de `refs/style_guide.md` se existir.
- "vertical" = 9:16 · "horizontal"/"YouTube" = 16:9 · "quadrado"/"feed" = 1:1 · "todos" = all.
- Nome curto: `videos/<slug-em-kebab>/` (ex.: `videos/meusite-lancamento/`).
- **Acima de 30 s**: crie `videos/<nome>/BRIEF.md` a partir de `templates/BRIEF.md` antes de começar.

## 2. Referência e marca
- Leia `refs/` (imagens: veja-as; vídeo: extraia frames e descreva o ritmo cena a cena; vários arquivos e sem
  `refs/style_guide.md`: crie o style guide primeiro). Copie paleta, tipografia e textura — não o assunto.
- Imagens enviadas na conversa → salve em `refs/`.
- URL de produto: tente baixar logo, cores, fontes e prints reais para `assets/<marca>/` (curl/WebFetch; o CSS do
  site revela cores e fontes). Rede bloqueada → **não invente a marca**: peça os arquivos e siga com placeholders
  neutros (cinza + um acento), deixando isso claro no NOTES.md.
- Fontes: use pacotes `@fontsource/*` (instale com `npm install @fontsource/<fonte>` se necessário e commite o
  package.json/package-lock.json). Nunca dependa de fonte da rede no render.

## 3. Spec
- Escolha o BPM (padrão 120; energético 120–128, minimalista 96–110, cinematográfico 80–100, lo-fi 80–90) e
  monte a grade: cenas começam em compassos/batidas.
- `videos/<nome>/spec.xml` a partir de `templates/spec.xml`: entradas, direção, estados (tempo + estado),
  regras, cuidados, reenquadre por formato.
- Gancho nos 2 primeiros segundos; algo novo a cada 3–5 s; uma ideia por cena.

## 4. Construir
- `videos/<nome>/index.html` copiando a estrutura de `videos/teste-estudio/index.html`:
  fontes carregadas antes de medir, `createLayout()/applyRoot()`, `beats(bpm, dur)`, `window.SCENES`,
  `window.DURATION`, `window.POSTER_T`, `seek(t)` puro que mostra a cena ativa e desenha o estado.
- Toda animação com `spring`/`springProgress`/`track`/`inOut`/`stagger` (presets: snappy UI, default
  cards/câmera, heavy tipografia/logo, playful mascotes). Nada de fade como entrada padrão.
- Proibido: texto centralizado em gradiente, logo genérico no final, clip-art.
- Stills primeiro: `npm run critique -- videos/<nome> --at <t das cenas-chave> --format 16:9,9:16` e olhe.

## 5. Preview + loop de crítica (até tudo 8+)
```bash
npm run preview  -- videos/<nome> --format <formatos>
npm run critique -- videos/<nome> --frames 8 --format <formatos>
```
- **Olhe** `contact_sheet.png` e, para detalhes, frames em `videos/<nome>/frames/` em resolução cheia.
- Mostre a tabela de notas 0–10 (composição, legibilidade, hierarquia, ritmo, fidelidade à referência,
  "parece feito por estúdio caro?") + os 3 piores problemas. Corrija e repita. Registre cada rodada no NOTES.md.
- `npm run check -- videos/<nome>` precisa passar (determinismo).

## 6. Áudio
- `videos/<nome>/audio.mjs` (modelo: `videos/teste-estudio/audio.mjs`) com `makeAudio(dir, { duration, bpm, style, events })`
  e eventos `impact | hit | whoosh | riser | click | drop` nos cortes e ações; rode `node videos/<nome>/audio.mjs`.
- Trilha do usuário em `audio/`: `npm run audio -- videos/<nome> --track audio/<arquivo> --duration <s>` e use
  `beats.json` (bpm, beats, strong) para alinhar os cortes; ajuste `seek` às batidas medidas.

## 7. Render final
```bash
npm run render -- videos/<nome> --fps 60 --format <formatos>
```
- MP4 > 90 MB → re-render com `--crf 21` (ou maior).
- Rode `npm run critique` uma última vez para o `contact_sheet.png` final.

## 8. Entregar
- `NOTES.md` (filme em uma linha, cenas, paleta, tipos, áudio, rodadas de crítica, pendências de marca).
- `git add videos/<nome> package.json package-lock.json refs assets` → commit → push. Se a sessão estiver numa
  branch que não é a `main`, abra/atualize um PR para `main` e avise o usuário para aprovar.
- Resposta final ao usuário: lista de arquivos (`out/final_*.mp4`, `poster.png`, `contact_sheet.png`, `NOTES.md`),
  tabela final de notas, e qualquer pendência (ex.: "envie o logo em SVG").
