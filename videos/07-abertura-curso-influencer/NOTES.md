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
