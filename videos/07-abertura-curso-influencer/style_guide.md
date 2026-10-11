# Style guide — 07 abertura curso Influencer com IA

Fonte: as 5 fotos em `assets/curso-influencer/` (paleta e textura) + o pedido "editorial premium".
Copiamos das fotos a **cor** e o **clima**; o assunto (cenários, roupas) não vira elemento gráfico.

## Paleta
| papel | hex | uso |
|---|---|---|
| papel | `#F2EDE4` | fundo (off-white quente, textura de papel com fibras) |
| tinta | `#161412` | tipografia, silhueta, sombra do duotone |
| vinho | `#7B2431` | ÚNICA cor de destaque: fios, rótulos "Nº", cursor de seleção. Amostrada do debrum da camisola (foto 03) |
| grafite | `#8B847A` | grid aparente, rótulos secundários, legendas futuras |
| papel-sombra | `#E4DDD1` | verso de página, fundos de quadro |

Duotone das fotos: tinta `#161412` → papel `#F2EDE4`, com meio-tom de pontos em 45° e um toque de vinho nos meios-tons só quando a cena pedir.

## Tipografia
- **Instrument Serif 400** (e itálico) — palavras-chave, títulos, números grandes. Caixa alta para palavra-impacto (ESTRATÉGIA), caixa baixa + itálico para títulos de revista.
- **Inter 500/600** — rótulos em caixa alta, `letter-spacing: .16em`, 1,3–1,6u (16:9) / 2,4–2,8u (9:16). Legendas em Inter 500, sentence case.
- Nunca gradiente, nunca contorno brilhante.

## Grid e diagramação
- 16:9: 12 colunas dentro da área segura, fios de 1 px a 10% de tinta; cabeçalho (fio + rótulos) e rodapé (fólio + seção).
- 9:16: 6 colunas, cabeçalho abaixo de 11% (interface), legenda acima dos 20% inferiores.
- Rótulos: `Nº 03 — Estratégia`, fólios `03`, marcas de corte nos cantos.

## Textura
- Papel: ruído fino + manchas de baixa frequência + fibras curtas (gerado com semente).
- Grão de filme fino por cima (mudando por frame de forma determinística), opacidade ≤ 6%.
- Fotos: borda de papel irregular (recorte), sombra curta e chapada (não difusa).

## Ritmo
- 87 BPM; cortes na batida, palavra-chave no instante em que é falada.
- Movimento "sem pressa": mola heavy, nada de overshoot em tipo; câmera ≤ 3% de zoom por cena.

## Evitar
Neon, glow, gradiente, glitch, HUD de "tecnologia/IA", tudo entrando com fade, clip-art, logos de marcas reais em destaque.
