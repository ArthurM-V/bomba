# Relatório de testes

## Situação do relatório

Os testes automatizados do painel local foram executados em 02/11/2026:
**26 testes em 6 arquivos aprovados**, seguidos de build de produção sem erros.
Eles cobrem controle automático, intertravamentos manuais, alternância, falhas,
tempo contínuo, manutenção, histórico, relatório, persistência e continuidade
do modo local após falha remota.

Os cenários abaixo ainda exigem demonstração assistida no painel e, para o caso remoto, Wokwi/Supabase. Para não produzir evidência falsa, nenhum cenário de campo foi marcado como aprovado sem captura de tela, CSV, Serial Monitor ou equivalente.

## Validação automatizada

| ID | Verificação | Evidência | Resultado |
|---|---|---|---|
| A01 | Lógica hidráulica, falhas, proteção e testes | `src/domain/simulator.test.ts` | Aprovado |
| A02 | Contrato de telemetria | `src/services/telemetryPayload.test.ts` | Aprovado |
| A03 | Conteúdo do CSV | `src/services/report.test.ts` | Aprovado |
| A04 | Compilação de produção | `npm run build` em 02/11/2026 | Aprovado |
| A10 | Estado inicial, reinício e continuidade local/remota | `src/hooks/useSimulation.test.ts` e `src/hooks/useRemoteTelemetry.test.ts` | Aprovado |
| A05 | Projeto Supabase e chave pública | Consulta HTTPS ao endpoint de autenticação: HTTP 200 | Aprovado |
| A06 | Publicação de `telemetry` | Consulta GET sem efeito: HTTP 405 esperado para rota POST | Aprovado |
| A07 | Publicação de `device-commands` | Consulta GET autenticada pelo dispositivo: HTTP 200 | Aprovado |
| A08 | Cadeia TLS do ESP32 | Certificado raiz público da cadeia do domínio configurado incluído em `wokwi/secrets.h` | Aprovado |
| A09 | Execução/compilação Wokwi | `wokwi-cli` não está instalado neste computador | Pendente |

## Cenários obrigatórios

| ID | Cenário | Evidência mínima | Situação atual | Responsável/data |
|---|---|---|---|---|
| T01 | Enchimento automático | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | Automação local / 02/11/2026 |
| T02 | Esvaziamento | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | Automação local / 02/11/2026 |
| T03 | Falta de água no RI | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | Automação local / 02/11/2026 |
| T04 | Alternância semanal | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | Automação local / 02/11/2026 |
| T05 | Teste individual | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | Automação local / 02/11/2026 |
| T06 | Falha de partida | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | Automação local / 02/11/2026 |
| T07 | Ausência de vazão | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | Automação local / 02/11/2026 |
| T08 | Comando remoto manual | Status e Serial Monitor | Pendente de execução no Wokwi/Supabase | — |
| T09 | Persistência e relatório | Teste de histórico/CSV em `presentation.test.ts` e `report.test.ts` | CSV aprovado na simulação automatizada; impressão/PDF e evidência visual pendentes | Automação local / 02/11/2026 |

Para cada cenário, anexe a evidência, registre data/hora e responsável e substitua o estado por `Aprovado` ou `Reprovado`. Em reprovação, registre a causa, correção e novo resultado.
