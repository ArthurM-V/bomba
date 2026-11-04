# API minima de telemetria

Esta pasta contem a primeira etapa do backend: a Edge Function HTTPS `telemetry`
e a migracao que cria a tabela de mesmo nome.

## Contrato da rota

`POST https://<project-ref>.supabase.co/functions/v1/telemetry`

Cabecalhos obrigatorios:

```text
Content-Type: application/json
X-Device-Key: <DEVICE_API_KEY>
```

O corpo e o JSON produzido por `wokwi/sketch.ino`. Alem dos campos de processo,
ele deve conter `bootId` (novo a cada inicializacao) e `eventSequence`
(crescente naquele ciclo). Essa dupla com `deviceId` torna os reenvios
idempotentes: um reenvio recebe `200 { "duplicate": true }`; uma nova leitura
recebe `201` com o ID do registro.

A funcao aceita somente JSON de ate 16 KiB, exatamente duas bombas com campos
tipados e o `DEVICE_ID` configurado. O banco permite no maximo uma nova leitura
por segundo para esse dispositivo; excedentes recebem `429`.

O painel React le a telemetria diretamente pela Data API somente apos login do
operador. A migracao `202610310003_allow_authenticated_dashboard_read.sql`
concede apenas `SELECT` ao papel `authenticated`; `anon` nao le nem escreve na
tabela.

## Comandos remotos

O operador autenticado insere comandos em `remote_commands`; as regras RLS
permitem criar comandos e visualizar somente os que ele solicitou. O ESP32 nao
recebe comandos diretamente do painel: ele consulta a Edge Function HTTPS
`device-commands` usando sua chave exclusiva, aplica as regras locais de
seguranca e confirma cada resultado como `executed` ou `rejected`.

As acoes disponiveis sao `set_mode`, `set_manual_pump` e `run_test`. O firmware
rejeita partida manual fora do modo manual, teste fora do modo automatico e
qualquer acao bloqueada por nivel ou indisponibilidade da bomba.

## Conectar o painel React

1. No Dashboard, crie o usuario do operador em **Authentication > Users**.
2. Copie `.env.example` para `.env` e informe `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY`, encontrados em **Settings > API Keys**.
3. Reinicie `npm run dev`, entre no painel com o usuario criado e aguarde a
   primeira leitura do ESP32.

A chave `VITE_SUPABASE_PUBLISHABLE_KEY` e publica por natureza. A protecao dos
dados vem da sessao do operador e das regras RLS; nunca coloque uma chave
`secret`, `service_role`, `DEVICE_API_KEY` ou a senha do banco no arquivo `.env`
do painel.

## Publicacao quando houver um projeto Supabase

1. Crie um projeto no painel do Supabase e instale/autentique a CLI.
2. Na raiz deste repositorio, execute `npx supabase link --project-ref <ref>`.
3. Defina a chave e o identificador permitidos: `npx supabase secrets set DEVICE_API_KEY=<chave-aleatoria-longa> DEVICE_ID=esp32-agua-01`.
4. Publique as migracoes: `npx supabase db push`.
5. Publique as funcoes:
   `npx supabase functions deploy telemetry` e
   `npx supabase functions deploy device-commands`.
6. Configure no firmware a URL final e a mesma chave em `DEVICE_API_KEY`.
   Configure tambem `DEVICE_COMMANDS_URL` com
   `https://<project-ref>.supabase.co/functions/v1/device-commands`.

Nao use `npx supabase secrets list` para conferir a configuracao: nesta versao
da CLI a saida pode incluir valores de segredos. Confirme a existencia deles no
Dashboard do Supabase sem revelar o valor.

## Retencao

O firmware envia uma leitura a cada cinco segundos (cerca de 17 mil registros
por dia). Como este projeto sera executado para uma demonstracao, nao existe
rotina automatica de exclusao: o historico permanece disponivel no banco
durante a apresentacao. Uma politica de retencao so sera necessaria se o
sistema passar a operar continuamente.

Para desenvolvimento local, copie `supabase/functions/.env.example` para
`supabase/functions/.env` e inicie a pilha com a CLI. Esse arquivo real fica
ignorado pelo Git.

## Estado de validacao

Em 01/11/2026, o endpoint de autenticacao do projeto respondeu HTTP 200, a
funcao `telemetry` respondeu HTTP 405 a uma consulta GET (comportamento
esperado para a rota POST) e `device-commands` respondeu HTTP 200. Em
02/11/2026, o painel local concluiu 33 testes automatizados em 7 arquivos e o
build de producao sem erros. Ainda falta executar o firmware no Wokwi/ESP32 e
registrar a primeira telemetria e o primeiro comando remoto confirmados de
ponta a ponta.
