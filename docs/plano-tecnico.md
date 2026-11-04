# Plano técnico — primeira versão navegável

## Objetivo desta etapa

Entregar um painel SCADA demonstrável inteiramente no navegador. Esta versão não depende de Wokwi, ESP32, MQTT ou backend: o simulador hidráulico e a lógica de operação executam no cliente.

## Stack

- React, TypeScript e Vite.
- Tailwind CSS para a interface.
- IndexedDB para manter a última simulação e o histórico resumido no navegador.
- Build estático preparado para Vercel (`vercel.json`).

IndexedDB foi escolhido para a primeira versão porque é persistente no navegador, não exige credenciais e permite demonstrar o comportamento completo sem infraestrutura externa. A camada `services/localStore.ts` é isolada do núcleo do simulador. A integração remota atual usa serviços próprios para Supabase; outros adaptadores HTTP podem ser adicionados ou substituídos sem alterar a lógica de domínio.

## Escopo implementado

1. Dois reservatórios virtuais, com volumes, entrada, consumo e transferência por recalque.
2. Controle automático com histerese: partida no nível superior baixo, parada no nível alto e bloqueio quando o reservatório inferior estiver baixo.
3. Modo manual, que ainda respeita intertravamentos e disponibilidade da bomba.
4. Alternância da bomba principal a cada 168 horas simuladas.
5. Falhas injetáveis: partida, indisponibilidade e ausência de vazão.
6. Atuação da reserva quando a principal estiver indisponível ou com falha de partida.
7. Horímetros, número de partidas, alarmes e histórico resumido.
8. Controle de níveis, consumo, relógio virtual, pausa e reinício no painel.

## Evoluções pendentes

- Publicar/configurar o ambiente Supabase e o Wokwi com as credenciais locais.
- Reconhecimento persistente de alarmes por operador.
- Relatórios agendados por e-mail e política de retenção para uso contínuo.
- Integração com sensores, relés e proteção elétrica físicos fora da simulação.

## Critérios de aceitação desta etapa

- Alterar os sliders muda a evolução da simulação.
- Nível superior baixo aciona a bomba principal disponível.
- Nível inferior crítico bloqueia o recalque inclusive no modo manual.
- Injetar falha de partida na principal faz a reserva ser selecionada em modo automático.
- A bomba principal alterna após uma semana simulada.
- Atualizar a página mantém o estado mais recente salvo no navegador.

## Evolução integrada — ESP32, Supabase e entrega

Além da primeira versão local, o repositório agora contém uma integração
implementada, porém dependente de publicação/configuração externa:

- Firmware ESP32/Wokwi com telemetria HTTPS, horímetros, alarmes, alternância,
  testes e intertravamentos locais.
- Edge Functions Supabase para ingestão de telemetria e retirada/confirmação de
  comandos remotos.
- Banco de dados com histórico, idempotência da telemetria e RLS para leitura e
  comandos do operador autenticado.
- Painel React que alterna automaticamente entre simulador local e telemetria
  do ESP32 após login no Supabase.
- Gráfico de níveis, exportação CSV, impressão/PDF e status de execução ou
  rejeição de comandos.

Para operar essa integração, é necessário aplicar as migrações, publicar as
funções e preencher as configurações locais descritas em `supabase/README.md`
e `wokwi/README.md`. O roteiro de validação final está em
`docs/roteiro-testes.md`.

### Verificação de integração — 01/11/2026

O projeto Supabase configurado respondeu ao endpoint de autenticação com HTTP
200; as funções `telemetry` e `device-commands` responderam respectivamente
HTTP 405 (método GET rejeitado pela rota POST, confirmando a publicação) e
HTTP 200. O certificado raiz TLS da cadeia apresentada pelo domínio configurado
foi incluído no `wokwi/secrets.h` local. Falta executar o firmware no Wokwi e
registrar a primeira telemetria e o primeiro comando remoto de ponta a ponta.

### Verificação local — 02/11/2026

Na cópia atual do repositório, `npm test` concluiu com **33 testes
aprovados em 7 arquivos** e `npm run build` foi concluído sem erros. Essa
validação confirma o simulador e a interface local; não substitui o ensaio
remoto ponta a ponta, que permanece pendente.

## Proposta de e-mail e acesso remoto

O relatório CSV e a impressão/PDF são gerados pelo painel. Para a operação
continuada, a proposta é executar uma função agendada no Supabase uma vez por
dia e quando ocorrer um alarme crítico: ela consultará os indicadores do
período, montará o relatório e o enviará por um provedor transacional (por
exemplo, Resend ou SMTP institucional) para a lista de manutenção. Essa etapa
depende da configuração externa do provedor e **não está implementada nesta
versão**.

O acesso remoto proposto é o painel web hospedado em HTTPS, com autenticação
do operador no Supabase e regras RLS para limitar leitura e comandos. O ESP32
envia telemetria e consulta comandos por HTTPS em rede Wi-Fi ou cabeada por um
ponto de acesso; em instalações sem essa infraestrutura, rádio industrial
pode substituir o enlace físico mantendo o mesmo contrato HTTPS. A publicação
e o ensaio ponta a ponta dessa arquitetura continuam pendentes de configuração
das credenciais e do ambiente externo.
