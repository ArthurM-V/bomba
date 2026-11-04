# Lista de entradas e saídas

Referência: [`wokwi/sketch.ino`](../../wokwi/sketch.ino) e [`wokwi/diagram.json`](../../wokwi/diagram.json). Botões e potenciômetros são simulações dos sinais de campo.

## Entradas

| Tag | GPIO | Tipo | Descrição |
|---|---:|---|---|
| AI_RI_NIVEL | 34 | Analógica | Nível do RI |
| AI_RS_NIVEL | 35 | Analógica | Nível do RS |
| DI_MODO | 25 | Digital | Auto/manual |
| DI_TESTE_B1 / DI_TESTE_B2 | 26 / 27 | Digital | Teste ou comando manual |
| DI_FALHA_PART_B1 / B2 | 32 / 33 | Digital | Falha de partida simulada |
| DI_SEM_VAZAO_B1 / B2 | 13 / 14 | Digital | Ausência de vazão simulada |

## Saídas e comunicação

| Tag | GPIO | Tipo | Descrição |
|---|---:|---|---|
| DO_RELE_B1 / B2 | 16 / 17 | Digital | Comando de relé |
| DO_K1 / K2 | 18 / 19 | Digital | Estado/simulação de contator |
| DO_ALARME | 5 | Digital | LED de alarme |
| DO_BUZZER | 23 | Digital | Buzzer |
| I²C_SDA / I²C_SCL | 21 / 22 | I²C | Display OLED |
| UART0 | TX0/RX0 | Serial | Diagnóstico |
| Wi-Fi | — | Rede | Telemetria e comandos HTTPS |

## Tags de supervisão

`RI_NIVEL`, `RS_NIVEL`, `B1_RUN`, `B2_RUN`, `B1_STARTS`, `B2_STARTS`, `BOMBA_PRINCIPAL` e `ALARMES_ATIVOS` são as tags usadas pelo painel para visualização, histórico e relatório.

As GPIOs e tags desta lista descrevem o protótipo Wokwi e o contrato de
supervisão. Não representam uma instalação de campo homologada; a validação
remota com ESP32/Wokwi e Supabase permanece pendente.
