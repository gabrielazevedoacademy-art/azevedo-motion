# teste-estudio — notas

**Filme em uma linha:** showreel de 8 s que prova o estúdio: tipografia cinética → morph de forma → câmera 3D → partículas, cortes a cada compasso de 120 BPM.

| | |
|---|---|
| Duração | 8 s (4 compassos de 2 s a 120 BPM) |
| Formatos | 16:9 (1920×1080) e 9:16 (1080×1920), 60 fps, H.264 yuv420p + AAC |
| Paleta | tinta #0B0B0D · papel #EFEAE0 · laranja sinal #FF4A1C |
| Tipos | Archivo Black (display), JetBrains Mono (HUD/legendas), via @fontsource |
| Áudio | `node videos/teste-estudio/audio.mjs` (energético, A menor, efeitos nos cortes) |

## Cenas (cortes na batida)
| t | cena | técnica | molas |
|---|---|---|---|
| 0–2 s | MOTION / FEITO EM / CÓDIGO. | tipografia cinética, máscara por letra, 1 linha por batida; o quadrado laranja sobe em 1,5 s | heavy (texto), snappy (régua/legenda) |
| 2–4 s | MORPH | um único path de 180 pontos (raio polar): tela cheia → círculo → quadrado → triângulo → estrela → círculo; o cursor clica em cada batida | snappy (cursor/contador), default (forma) |
| 4–6 s | grade de 12 cards | câmera CSS 3D com `track()` de 4 alvos, dolly até o card SEEK(T) | default (câmera) |
| 6–8 s | AZEVEDO MOTION | ~6 mil partículas com semente, voo com stagger por x e onda de choque na batida 14 | default + impulso amortecido |

## Loop de crítica
| rodada | composição | legibilidade | hierarquia | ritmo | fidelidade | estúdio caro | principais correções |
|---|---|---|---|---|---|---|---|
| 1 | 6 | 5 | 6 | 7 | 7 | 5 | fitText medindo cena oculta (texto estourando no 9:16/1:1), acento do "Ó" cortado, S3 começava vazio, partículas com cara de confete |
| 2 | 7 | 7 | 7 | 8 | 8 | 7 | blocos centralizados verticalmente no 9:16, wordmark ajustado à largura |
| 3 | 7 | 8 | 7 | 8 | 8 | 7 | círculo gigante tapando o título → mola snappy na transição, acento vazando |
| 4 | 8 | 8 | 8 | 9 | 8 | 8 | forma menor/deslocada, tagline maior |

Determinismo verificado com `npm run check`.
