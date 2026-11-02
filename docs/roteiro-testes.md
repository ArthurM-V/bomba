# Roteiro de testes — SCADA de abastecimento de água

Use este roteiro na demonstração e registre, para cada cenário, data, responsável,
evidência visual/Serial Monitor e resultado (`aprovado` ou `reprovado`). O relógio
deve estar no perfil de apresentação para reduzir a duração dos ensaios.

| ID | Cenário | Preparação e ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| T01 | Enchimento automático | Deixar o nível superior cair para 30% ou menos. | A principal da semana parte; o superior sobe e a bomba para em 85%. | Painel, LED/relé e histórico. |
| T02 | Esvaziamento | Manter as bombas desligadas e aguardar consumo no superior. | O superior reduz conforme o consumo simulado; novo recalque só ocorre ao atingir 30%. | Gráfico e CSV. |
| T03 | Falta de água inferior | Ajustar/injetar nível inferior em 15% ou menos durante recalque. | Bomba desliga; alarme crítico é registrado; manual também fica bloqueado. | Painel, OLED e Serial Monitor. |
| T04 | Alternância semanal | Usar **+1 semana** no relógio da simulação e gerar nova demanda. | A bomba principal muda de B1 para B2, ou vice-versa. O avanço processa todo o período simulado. | Campo “Bomba principal” e telemetria. |
| T05 | Teste individual | Em automático, com inferior ≥25%, superior entre a partida e 70% e sem demanda, solicitar teste B1 e depois B2. | Cada bomba opera isoladamente por 15 min simulados; aprova com partida, sem ausência de vazão e ganho do RS ≥1,0%. | Selo “EM TESTE”, relé, resultado, horímetro e histórico. |
| T06 | Falha de partida | Ativar falha de partida na principal e induzir demanda de recalque. | A falha é detectada no ciclo de seleção, sem timeout; há alarme de partida e a reserva é selecionada se segura. | Painel, alarmes e partidas; Serial Monitor no ensaio ESP32. |
| T07 | Ausência de vazão | Ativar “sem vazão” na bomba em operação. | Após 10 min simulados sem elevação, gera alarme; no ciclo de controle seguinte, a reserva é selecionada se segura. | Gráfico sem subida, alarme e comando da reserva. |
| T08 | Comando remoto manual | No painel, entrar como operador, selecionar manual e solicitar B1; repetir com nível inferior crítico. | O primeiro comando é confirmado; o segundo é rejeitado/bloqueado pelo ESP32. | Status `executed`/`rejected`, painel e Serial Monitor. |
| T09 | Persistência e relatório | Gerar telemetria suficiente, exportar CSV e usar Imprimir/PDF. | Arquivo contém resumo, horímetros, partidas, alarmes e histórico. | CSV e PDF/print. |

## Registro de resultado

| Cenário | Data/hora | Responsável | Resultado | Observações/evidência |
|---|---|---|---|---|
| T01 |  |  |  |  |
| T02 |  |  |  |  |
| T03 |  |  |  |  |
| T04 |  |  |  |  |
| T05 |  |  |  |  |
| T06 |  |  |  |  |
| T07 |  |  |  |  |
| T08 |  |  |  |  |
| T09 |  |  |  |  |
