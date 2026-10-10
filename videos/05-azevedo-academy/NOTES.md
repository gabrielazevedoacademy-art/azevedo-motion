# 05-azevedo-academy — notas

**Filme em uma linha:** "simplificar o complexo" (frase da descrição do canal): o caos vira ordem no gancho, e o resto do filme é a prova — o canal se monta, os 3 vídeos mais vistos, o número real, a assinatura com clique no Inscrever-se.

| | |
|---|---|
| Duração | 20 s · 120 BPM (40 batidas, 10 compassos) |
| Formatos | 16:9 (1920×1080) e 9:16 (1080×1920), mesma linha do tempo, 60 fps |
| Material | 100% real, em `assets/azevedo-academy/` (capturado em 2026-10-10 com Playwright + ytInitialData) |
| Paleta | fundo #0E0C09 · laranja #F97102 · lima #BBE000 / #DEED1E · papel #F4F1EA (amostrada do banner com PIL) |
| Tipos | Anton (cinética e números, eco das miniaturas) · Bebas Neue (assinatura, eco do banner) · JetBrains Mono (HUD) · Roboto da interface só via recortes reais |
| Áudio | `node videos/05-azevedo-academy/audio.mjs` — energético em Mi, whoosh + hit em cada corte, clique em cada clique do cursor, 6 cliques nos rolos do contador, drop no 755.494, clique duplo forte + hit + impacto no Inscrever-se (18 s) |

## O que é real (e de onde veio)
| no vídeo | fonte |
|---|---|
| "SIMPLIFICAR O COMPLEXO." | descrição: "Meu objetivo é simplificar o complexo…" |
| "Inteligência Artificial · Design · Tecnologia" | descrição: "…dominar a Inteligência Artificial, o Design e a Tecnologia" |
| banner, foto de perfil | `banner_strip.jpg` (banner_full 2048×1152 recortado), `avatar_900.jpg` |
| "Azevedo - Academy · @Azevedo.Academy · 22,7 mil inscritos · 67 vídeos" | recorte 3x do cabeçalho do canal (fundo #0F0F0F removido por alpha de luminância) |
| "No ar desde 3 de dez. de 2025 · Brasil" | painel Sobre: "Inscreveu-se em 3 de dez. de 2025", "Brasil" |
| 3 vídeos (#1–#3 "Em alta") | aba Vídeos → Em alta: 268 mil, 174 mil, 36 mil (miniaturas maxres + recortes 3x de título/views) |
| painel de números + 755.494 | painel Sobre → "Mais informações" (recorte 3x); o contador termina no valor real |
| botão "Inscrever-se", sino | recorte 3x do botão real; sino recortado do próprio banner |
| "▶ Novo vídeo toda semana", youtube.com/@Azevedo.Academy | texto do banner; URL canônica do canal |

Nada de miniatura, título, número ou interface inventados. A tela de cookies não apareceu (o script recusaria o opcional).

## Cenas
| t | batida | cena | técnica | molas |
|---|---|---|---|---|
| 0–3 s | 0–6 | GANCHO | letras de COMPLEXO espalhadas em contorno lima com linhas emaranhadas (já em movimento no frame 0) → encaixam na batida 2 e viram laranja; SIMPLIFICAR sobe por máscara | snappy (encaixe), heavy (texto) |
| 3–6 s | 6–12 | O CANAL | banner real em 16 peças voando em 3D; foto em 4 quadrantes; anel laranja; recorte do cabeçalho abre por máscara; brilho lima varre o banner | default (peças), heavy (foto), snappy (UI) |
| 6–12 s | 12–24 | EM ALTA ×3 | trilho de câmera com chicote (desfoque ∝ velocidade); miniatura abre do centro; cursor clica na batida; título real ganha moldura lima, miniatura escurece, número fica lima | snappy (câmera, cursor), default (miniatura), heavy (números) |
| 12–16 s | 24–32 | O NÚMERO | painel real "Mais informações" entra; linha 755.494 ganha moldura; fio lima liga ao contador em rolos; cada dígito trava numa semicolcheia (12,75→14,0) com rastro de movimento | default, k=300/c=36 (rolos), heavy |
| 16–20 s | 32–40 | ASSINATURA | foto abre em círculo + anel; AZEVEDO / ACADEMY por letra; URL; botão real; clique forte em 18 s: afunda, ondas, estrelas de 4 pontas, tremor curto, sino balança | heavy (texto/foto), snappy (botão), playful (sino) |

Cortes 3 / 6 / 12 / 16 s cobertos por cortina diagonal (escuro · laranja · lima) — uma mola criticamente amortecida que cruza 50% exatamente no corte (cobertura 99–100% de c−0,035 a c+0,048 s, medida nos quadros).

## Loop de crítica
| rodada | composição | legibilidade | hierarquia | ritmo | fidelidade | estúdio caro | principais correções |
|---|---|---|---|---|---|---|---|
| 1 | 6 | 7 | 7 | 7 | 7 | 6 | recortes da interface com caixa escura (mix-blend não atravessa grupos com clip-path → alpha por luminância); til do Õ e circunflexo do Ê espiando pela máscara (subida 112% → 150%); fundo verde-oliva lamacento (brilhos e riscos só nas bordas, como no banner) |
| 2 | 7 | 8 | 8 | 8 | 8 | 7 | 9:16: foto cobrindo o banner; costuras finas nas peças montadas (troca pela imagem inteira após travar); cantos do recorte do botão; coluna direita do S3 desequilibrada |
| 3 | 8 | 8 | 8 | 7 | 9 | 8 | cortina parada 0,2 s em laranja chapado (→ mola única, ~5 quadros de cobertura); quadro vazio após o corte para o canal (peças começam atrás da cortina); `seek` não determinístico (camadas 3D/`will-change`/`filter: blur` com raster em cache → transformações 2D e rastro pintado com text-shadow) |
| 4 | 8 | 9 | 8 | 9 | 9 | 8 | moldura do título encostando no índice "01 / 03" (zoom 7% → 4%, coluna afastada) |

Determinismo: `npm run check` ✓ em 16:9 e 9:16 (16 amostras cada).

## Entrega
| arquivo | |
|---|---|
| `out/final_16x9.mp4` | 1920×1080 · 60 fps · H.264 yuv420p + AAC 48 kHz · 20,0 s · 29 MB |
| `out/final_9x16.mp4` | 1080×1920 · 60 fps · H.264 yuv420p + AAC 48 kHz · 20,0 s · 27 MB |
| `poster.png` / `poster_9x16.png` | quadro t = 19,6 s (assinatura) |
| `contact_sheet.png` | um quadro por batida da história, 16:9 e 9:16 (aprovada pelo usuário antes do render) |

Render: `npm run render -- videos/05-azevedo-academy --fps 60 --format 16:9` e `--format 9:16`.
Para recapturar o canal: `node assets/azevedo-academy/capture.mjs --dark`, `capture_about.mjs`, `capture_cards.mjs`, `capture_hires.mjs` (os números mudam com o tempo — o vídeo usa os de 2026-10-10).
