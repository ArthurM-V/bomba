# Handover técnico — SCADA de abastecimento de água

**Data de consolidação:** 02/11/2026  
**Versão do projeto:** 0.1.0  
**Finalidade:** servir como base factual para o relatório técnico e para a continuidade do desenvolvimento/demonstração.

## 1. Resumo executivo

O repositório implementa um painel SCADA para o abastecimento de uma edificação, composto por reservatório inferior (RI), reservatório superior (RS) e duas bombas de recalque (B1 e B2). O produto possui dois modos de operação:

- **Local (pronto para demonstração):** simulador hidráulico no navegador, persistência em IndexedDB, controle automático/manual, proteções, alarmes, histórico, tendência e exportação de relatório.
- **Remoto (código pronto, validação pendente):** firmware ESP32 para Wokwi, banco e Edge Functions Supabase, autenticação de operador e comandos remotos por HTTPS.

O modo local é a evidência principal desta entrega. A integração remota não deve ser apresentada como homologada: exige publicação/configuração de credenciais e ensaio ponta a ponta ESP32/Wokwi → Supabase → painel.

## 2. Escopo funcional entregue

| Área | Entregue e demonstrável | Limite atual |
|---|---|---|
| Processo | Simulação de RI, RS, entrada, consumo e recalque | Não há instalação hidráulica física |
| Controle | Automático com histerese, manual com intertravamentos e alternância semanal B1/B2 | Parâmetros representam o modelo simulado |
| Proteções | Bloqueio por RI baixo/RS alto, indisponibilidade, falha de partida e ausência de vazão | Proteção elétrica de potência não foi construída |
| Operação | Teste individual de bombas, horímetros, contagem de partidas e manutenção preventiva | Testes são simulados no modo local |
| Supervisão | Alarmes, tendências, histórico, CSV e impressão/PDF via navegador | E-mail agendado não está implementado |
| Dados locais | Persistência offline com IndexedDB | Retenção limitada a 100 alarmes e 96 snapshots operacionais |
| Comunicação remota | Contratos, firmware, migrações e Edge Functions no repositório | Depende de Supabase, usuário operador, segredos e ESP32/Wokwi ativos |

## 3. Arquitetura e fluxo operacional

```text
Modo local:    Operador → Painel React/Vite → simulador TypeScript → IndexedDB

Modo remoto:   Operador → Painel React (login) → Supabase/Postgres
                                               ↑             ↓
                                         HTTPS telemetria  comandos
                                               ↑             ↓
                                           ESP32/Wokwi ← regras locais de segurança
```

O núcleo de regras está em `src/domain/` e não depende de React nem de IndexedDB. A interface React consome esse núcleo pelo hook de simulação; persistência local, telemetria REST e geração de relatório estão separadas em serviços. Caso a telemetria remota fique indisponível, o painel retorna ao simulador local sem exibir dados remotos antigos como ativos.

### Lógica de processo configurada por padrão

- Solicita recalque quando o RS chega a **30%** ou menos e para em **85%**.
- Bloqueia o recalque quando o RI chega a **15%**; uma nova partida requer RI de ao menos **25%**.
- Bloqueia também em alarme alto do RS (**95%**).
- Alterna a bomba principal a cada **168 horas simuladas**.
- Detecta ausência de vazão após **10 minutos simulados** sem elevação do RS.
- O teste individual opera por **15 minutos simulados**; aprova quando há partida, não há ausência de vazão e o RS sobe pelo menos **1,0%**.

Mesmo em modo manual, as proteções permanecem ativas. Falha de partida ou indisponibilidade da principal permite selecionar a reserva somente quando as condições de segurança são atendidas.

## 4. Componentes e interfaces relevantes

| Camada | Tecnologia / artefatos |
|---|---|
| Painel | React 19, TypeScript, Vite e Tailwind CSS (`src/`) |
| Testes | Vitest (`src/**/*.test.ts`) |
| Persistência local | IndexedDB (`src/services/localStore.ts`) |
| Integração | Supabase Postgres, RLS e Edge Functions (`supabase/`) |
| Controlador | ESP32/Wokwi (`wokwi/sketch.ino`, `wokwi/diagram.json`) |
| Deploy web | Build estático; roteamento SPA configurado em `vercel.json` |

Entradas simuladas no ESP32: níveis RI/RS, modo, testes/comando manual, falha de partida e ausência de vazão. Saídas: relés B1/B2, estados de contatores, LED, buzzer, OLED, Serial e HTTPS. A relação completa de GPIOs está em `docs/entrega/lista-io.md`.

## 5. Estado da validação

Em **02/11/2026**, foram executados novamente na cópia atual do repositório:

| Verificação | Resultado |
|---|---|
| `npm test` | **33 testes aprovados em 7 arquivos** |
| `npm run build` | **Aprovado** — TypeScript e build Vite concluídos sem erros |
| Wokwi/ESP32 | Pendente: `wokwi-cli` não está disponível nesta máquina e não há evidência de telemetria ponta a ponta |
| Comandos remotos | Pendente de execução assistida com Wokwi/Supabase |
| Evidência visual/CSV/PDF dos cenários | Parcial: testes automatizados aprovados; capturas para demonstração ainda devem ser registradas |

O relatório de testes foi alinhado a este resultado. Para o relatório técnico, utilizar a contagem acima e anexar a saída dos comandos como evidência.

## 6. Segurança e dados

- O painel deve conter apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_DEVICE_ID` em `.env`.
- Segredos de dispositivo (`DEVICE_API_KEY`), chave `service_role`, senhas de banco e certificados não podem ser versionados nem expostos no painel.
- A telemetria é enviada por HTTPS com `X-Device-Key`; o contrato usa `deviceId`, `bootId` e `eventSequence` para idempotência.
- A API limita novas leituras a uma por segundo por dispositivo e valida payload JSON de até 16 KiB.
- O painel acessa a telemetria após login; RLS restringe a leitura a usuários autenticados e os comandos ao respectivo solicitante.
- Na configuração atual, o ESP32 publica aproximadamente uma leitura a cada cinco segundos (~17 mil registros/dia). Não existe rotina automática de retenção para uso contínuo.

## 7. Procedimento de continuidade

### Executar o painel local

```powershell
npm install
npm run dev
```

Validar antes de qualquer entrega:

```powershell
npm test
npm run build
```

### Habilitar a integração remota

1. Criar/configurar o projeto Supabase e o usuário operador.
2. Copiar `.env.example` para `.env` e informar somente as variáveis públicas do painel.
3. Vincular a CLI ao projeto, definir `DEVICE_API_KEY` e `DEVICE_ID` como segredos, aplicar migrações e publicar as funções `telemetry` e `device-commands`.
4. Criar `wokwi/secrets.h` a partir de `wokwi/secrets.h.example`; informar URLs finais, a mesma chave do dispositivo e a CA raiz TLS válida.
5. Executar o projeto Wokwi, confirmar a primeira telemetria no Supabase e fazer pelo menos um comando remoto aceito e outro corretamente rejeitado por intertravamento.
6. Preencher o registro de testes em `docs/roteiro-testes.md`, anexando painel, Serial Monitor, CSV e/ou PDF conforme o cenário.

Consultar `supabase/README.md` e `wokwi/README.md` antes da publicação. Não usar comandos que listem segredos em texto aberto.

## 8. Pendências, riscos e recomendações

| Prioridade | Item | Ação recomendada |
|---|---|---|
| Alta | Ensaio remoto ponta a ponta | Validar T08 com evidência de telemetria, status `executed` e `rejected`, e Serial Monitor |
| Alta | Evidências de apresentação | Executar T01–T09 e preencher data, responsável, resultado e anexos no roteiro |
| Alta | Segurança física | Dimensionar contatores, disjuntores, relés térmicos, parada de emergência, fonte e instrumentação por profissional habilitado |
| Média | Retenção de dados | Definir prazo e rotina de exclusão/agregação para telemetria de operação contínua |
| Média | Alarmes | Implementar reconhecimento persistente por operador no ambiente remoto |
| Média | Relatórios | Implementar função agendada e provedor transacional para e-mails de rotina/alarme crítico |
| Baixa | Vídeo de contingência | Gravar a demonstração remota após o ensaio bem-sucedido |

## 9. Texto-base para conclusão do relatório técnico

> Foi desenvolvido um sistema SCADA demonstrável para supervisão de abastecimento de água com dois reservatórios e duas bombas de recalque. A versão local implementa modelo hidráulico, controle automático e manual com intertravamentos, alternância semanal, tratamento de falhas, alarmes, histórico, tendências e geração de relatórios. A qualidade do software foi verificada por 33 testes automatizados distribuídos em 7 arquivos e por compilação de produção concluída sem erros em 02/11/2026. A arquitetura também contempla telemetria e comandos remotos por ESP32, HTTPS e Supabase; essa integração está implementada no repositório, porém sua homologação permanece condicionada à configuração do ambiente e à execução do ensaio ponta a ponta. Portanto, os resultados comprovam o funcionamento do simulador local, enquanto a operação remota e a instrumentação física devem ser tratadas como etapa subsequente de validação e implantação.

## 10. Referências internas

- `README.md` — visão geral e execução.
- `docs/plano-tecnico.md` — decisões, critérios e evolução.
- `docs/implementado-previsto.md` — matriz de escopo.
- `docs/roteiro-testes.md` — cenários e registro de evidências.
- `docs/entrega/memorial-descritivo.md` — sequência de processo e alarmes.
- `docs/entrega/lista-componentes.md`, `lista-io.md` e `diagramas.md` — hardware, sinais e diagramas.
- `docs/entrega/relatorio-testes.md` — histórico de validação atualizado.
- `supabase/README.md` e `wokwi/README.md` — configuração remota e firmware.
