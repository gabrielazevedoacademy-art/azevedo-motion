# NOTES — 07 abertura curso Influencer com IA

## Decisões
- Imagens: `assets/curso-influencer/01..05` — mapa de uso aprovado (ver spec.xml).
- Cor de destaque: vinho `#7B2431`, amostrado do debrum da camisola (foto 03).
- Voz: ElevenLabs Liam, `eleven_multilingual_v2`, variante **B (equilibrada)** — estabilidade 0,50, estilo 0,15, velocidade 1,05, seed 707.
- Edição da voz (`voz/editar.mjs`): só silêncios entre frases (+0,27 s de pausa dramática depois de "rosto", −0,12/−0,21/−0,26/−0,14 s em pausas longas, +0,06 s antes da assinatura) e atempo 1,02 (tom preservado). Narração final: 0,20–28,88 s. Assinatura entra em 27,38 e segura até 30,0 (2,62 s).
- Grade: 87,05 BPM, downbeats em "estratégia" (8,08) e na assinatura (27,38).

## Style frame (ESTRATÉGIA, t = 9,3 s)
- Rodada 1: zoom de câmera empurrava a palavra para fora da margem; legenda não aparecia (fim de bloco indefinido); sobrescrito longe da palavra.
- Rodada 2: acento do É em vinho desalinhado (proporção fixa) → medido com TextMetrics; 9:16 com cabeçalho/rodapé fora da área segura → movidos para dentro.
- Rodada 3: OK → `styleframe_16x9.png`, `styleframe_9x16.png`.
- Rodada 4 (pedido do cliente): removida toda a escrita miúda — cabeçalho, fólio, seção, "Editorial — Estratégia", nota de rodapé e sobrescrito. Ficam só a frase de entrada, ESTRATÉGIA, o fio vinho e a legenda (aumentada para 2,5u / 3,5u). Regra vale para o vídeo inteiro.

## Construção
- Sem informação inventada (decisão do cliente): nada de seguidores, etiquetas de marca ou texto no contrato. O contrato é uma folha com linhas cinza e uma assinatura traçada; a capa do produto mostra a foto 05 + "Influencer com IA".
- Máscaras (`assets/curso-influencer/mascaras/`) geradas localmente das fotos 01, 02 e 03 (remoção de fundo, sem gerar pixels novos). As de 04 e 05 vazaram para o cenário e foram descartadas — essas fotos entram só em quadro retangular.
- Paleta da cena Identidade = cores reais amostradas da foto 03 (debrum vinho, rosa da estampa, creme do tecido).
- Áudio (`audio.mjs`): trilha 87,05 BPM em Ré menor (pads, cordas, piano grave, sub, pulso), 27 efeitos graves nos cortes, ducking −12 dB pela voz, mix −14,0 LUFS / −1,4 dBTP (medido no MP4).

## Loop de crítica (vídeo)
| rodada | formato | composição | legibilidade | hierarquia | ritmo | fidelidade | estúdio caro? |
|---|---|---|---|---|---|---|---|
| 1 | 16:9 | 6 | 7 | 7 | 7 | 8 | 6 |
| 2 | 16:9 | 8 | 8 | 8 | 8 | 9 | 8 |
| 2 | 9:16 | 6 | 6 | 7 | 8 | 8 | 6 |
| 3 | 16:9 | 8 | 8 | 8 | 8 | 9 | 8 |
| 3 | 9:16 | 8 | 8 | 8 | 8 | 8 | 8 |

- Rodada 1: textos medidos com páginas ocultas (largura 0 → palavras sobrepostas, "do zero" sumido); letras vazando por baixo das máscaras; 3 lupas sobrepostas; ícone de sacola sobre a foto; fibras do papel concentradas num canto (rng 0..1 tratado como −1..1).
- Rodada 2: foto 01 sozinha à esquerda com meia página vazia → começa centralizada e desliza quando "rosto." entra; sobra da borda da foto sob a silhueta; frase de entrada cruzando RENDA; recorte da foto 02 sem cabeça; anel do clique seguindo o cursor; `seek` só exposto depois do carregamento (o motor congela rAF) → contrato exposto na hora e carregamento em READY.
- Rodada 3 (9:16): "inteligência artificial" batendo na legenda; renda em 3 linhas minúsculas → 2 colunas + produto embaixo; silhueta pequena → maior com "rosto." ao lado.

## Entrega
- `out/final_16x9.mp4` — 1920×1080, 60 fps, 30,0 s, 76 MB (render CRF 17 reencodado em CRF 21: o grão animado do papel levava o arquivo a 215 MB; CRF 21 mantém o meio-tom idêntico ao master).
- `out/final_9x16.mp4` — 1080×1920, 60 fps, 30,0 s, 58 MB (CRF 21).
- `poster.png` (16:9, t = 29,3 s), `poster_9x16.png`, `contact_sheet.png` (um quadro por frase, 16:9 + 9:16).
