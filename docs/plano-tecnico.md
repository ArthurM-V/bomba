# Plano técnico — primeira versão navegável

## Objetivo desta etapa

Entregar um painel SCADA demonstrável inteiramente no navegador. Esta versão não depende de Wokwi, ESP32, MQTT ou backend: o simulador hidráulico e a lógica de operação executam no cliente.

## Stack

- React, TypeScript e Vite.
- Tailwind CSS para a interface.
- IndexedDB para manter a última simulação e o histórico resumido no navegador.
- Build estático preparado para Vercel (`vercel.json`).

IndexedDB foi escolhido para a primeira versão porque é persistente no navegador, não exige credenciais e permite demonstrar o comportamento completo sem infraestrutura externa. A camada `services/localStore.ts` é isolada: ela será substituída por um adaptador HTTP para Node.js/Express numa etapa futura, sem alterar o núcleo do simulador.

## Escopo implementado

1. Dois reservatórios virtuais, com volumes, entrada, consumo e transferência por recalque.
2. Controle automático com histerese: partida no nível superior baixo, parada no nível alto e bloqueio quando o reservatório inferior estiver baixo.
3. Modo manual, que ainda respeita intertravamentos e disponibilidade da bomba.
4. Alternância da bomba principal a cada 168 horas simuladas.
5. Falhas injetáveis: partida, indisponibilidade e ausência de vazão.
6. Atuação da reserva quando a principal estiver indisponível ou com falha de partida.
7. Horímetros, número de partidas, alarmes e histórico resumido.
8. Controle de níveis, consumo, relógio virtual, pausa e reinício no painel.

## Próximas etapas — não implementadas agora

- Firmware ESP32/Wokwi e sinais físicos/virtuais.
- Backend Node.js + Express, SQLite compartilhado, API e autenticação.
- Comunicação externa (HTTP ou MQTT, conforme decisão da equipe).
- Relatórios exportáveis, gráficos completos e reconhecimento persistente de alarmes.

## Critérios de aceitação desta etapa

- Alterar os sliders muda a evolução da simulação.
- Nível superior baixo aciona a bomba principal disponível.
- Nível inferior crítico bloqueia o recalque inclusive no modo manual.
- Injetar falha de partida na principal faz a reserva ser selecionada em modo automático.
- A bomba principal alterna após uma semana simulada.
- Atualizar a página mantém o estado mais recente salvo no navegador.
