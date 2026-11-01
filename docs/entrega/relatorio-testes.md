# Relatório de testes

## Situação do relatório

Os testes automatizados do núcleo local foram executados em 01/11/2026: **14 testes em 3 arquivos aprovados**, seguido de build de produção sem erros. Eles cobrem controle automático, intertravamentos manuais, alternância, falha de partida, ausência de vazão com reserva, rotina de teste, alarmes e CSV.

Os cenários abaixo ainda exigem demonstração assistida no painel e, para o caso remoto, Wokwi/Supabase. Para não produzir evidência falsa, nenhum cenário de campo foi marcado como aprovado sem captura de tela, CSV, Serial Monitor ou equivalente.

## Validação automatizada

| ID | Verificação | Evidência | Resultado |
|---|---|---|---|
| A01 | Lógica hidráulica, falhas, proteção e testes | `src/domain/simulator.test.ts` | Aprovado |
| A02 | Contrato de telemetria | `src/services/telemetryPayload.test.ts` | Aprovado |
| A03 | Conteúdo do CSV | `src/services/report.test.ts` | Aprovado |
| A04 | Compilação de produção | `npm run build` | Aprovado |
| A05 | Projeto Supabase e chave pública | Consulta HTTPS ao endpoint de autenticação: HTTP 200 | Aprovado |
| A06 | Publicação de `telemetry` | Consulta GET sem efeito: HTTP 405 esperado para rota POST | Aprovado |
| A07 | Publicação de `device-commands` | Consulta GET autenticada pelo dispositivo: HTTP 200 | Aprovado |
| A08 | Cadeia TLS do ESP32 | Certificado raiz público da cadeia do domínio configurado incluído em `wokwi/secrets.h` | Aprovado |
| A09 | Execução/compilação Wokwi | `wokwi-cli` não está instalado neste computador | Pendente |

## Cenários obrigatórios

| ID | Cenário | Evidência mínima | Situação atual | Responsável/data |
|---|---|---|---|---|
| T01 | Enchimento automático | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | |
| T02 | Esvaziamento | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | |
| T03 | Falta de água no RI | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | |
| T04 | Alternância semanal | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | |
| T05 | Teste individual | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | |
| T06 | Falha de partida | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | |
| T07 | Ausência de vazão | Teste `presentation.test.ts` | Aprovado na simulação automatizada; evidência visual pendente | |
| T08 | Comando remoto manual | Status e Serial Monitor | Pendente de execução no Wokwi | |
| T09 | Persistência e relatório | Teste de histórico/CSV em `presentation.test.ts` | CSV aprovado na simulação automatizada; impressão/PDF e evidência visual pendentes | |

Para cada cenário, anexe a evidência, registre data/hora e responsável e substitua o estado por `Aprovado` ou `Reprovado`. Em reprovação, registre a causa, correção e novo resultado.
