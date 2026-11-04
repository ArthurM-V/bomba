# Lista de componentes

| Item | Qtd. | Função | Situação |
|---|---:|---|---|
| ESP32 DevKit V1 | 1 | Lógica, I/O, tela e comunicação | Wokwi/proposto físico |
| Painel React/TypeScript | 1 | Supervisão, comandos, tendências e relatórios | Implementado |
| IndexedDB | 1 | Persistência do simulador local | Implementado |
| Supabase (Postgres e Edge Functions) | 1 projeto | Telemetria, autenticação e comandos | Rotas verificadas em 01/11/2026; integração ponta a ponta pendente |
| OLED I²C 128×64 | 1 | Indicação local de processo e alarmes | Wokwi |
| LED e buzzer | 1 de cada | Sinalização de alarme | Wokwi |
| Sensor de nível do RI | 1 | Nível inferior | Potenciômetro no Wokwi; transmissor analógico previsto |
| Sensor de nível do RS | 1 | Nível superior | Potenciômetro no Wokwi; transmissor analógico previsto |
| Módulo relé | 2 | Interface de comando de B1/B2 | Wokwi |
| Contator K1/K2 | 2 | Acionamento de potência dos motores | LED no Wokwi; previsto físico |
| Bombas B1/B2 | 2 | Recalque RI → RS | Modelo hidráulico no simulador |
| Disjuntor-motor/relé térmico | 2 | Proteção dos motores | Previsto físico |
| Disjuntor geral e fonte de comando | 1 conjunto | Proteção e alimentação do painel | Previsto físico |
| Wi-Fi ou Ethernet | 1 | Comunicação HTTPS | Proposto; Wi-Fi no Wokwi |

Para implantação real, contatores, proteção, parada de emergência, fonte e instrumentação devem ser dimensionados por profissional habilitado conforme as características elétricas e hidráulicas do local.

O painel local foi validado em 02/11/2026 com 33 testes automatizados em 7
arquivos e build de produção sem erros. Essa validação não constitui aceite de
componente físico ou da comunicação ESP32/Supabase.
