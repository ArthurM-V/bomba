# Implementado e previsto

Esta matriz separa o que pode ser demonstrado no painel atual do que depende
de infraestrutura externa ou ainda é uma evolução proposta.

| Recurso | Situação | Como é demonstrado |
|---|---|---|
| Simulação hidráulica RI/RS, modos automático e manual, intertravamentos e alternância semanal | Implementado localmente | Aba **Operação** e cenários de demonstração |
| Teste individual B1/B2, falha de partida, ausência de vazão e falta de água | Implementado localmente | Cenários de demonstração e aba **Alarmes** |
| Horímetros, partidas, tempo contínuo e manutenção preventiva | Implementado localmente | Sinóptico, histórico, relatório e cenários preventivos |
| Alarmes com ocorrência, normalização e reconhecimento | Implementado localmente | Aba **Alarmes** |
| Tendências, histórico, CSV e impressão/salvamento em PDF | Implementado localmente | Aba **Histórico e relatório** |
| Persistência do simulador | Implementada com IndexedDB | Funciona no navegador e offline |
| Leitura de telemetria e comandos remotos | Implementado no código; requer Supabase, usuário operador e ESP32 configurados | Aba **Conexão remota** |
| Continuidade após queda de rede | Implementada no painel | Falha remota devolve a interface ao simulador local |
| Firmware ESP32/Wokwi e Edge Functions | Implementados no repositório; ensaio de ponta a ponta pendente | Ver `wokwi/` e `supabase/` |
| Vídeo de reserva da demonstração remota | Previsto | Deve ser gravado pelo grupo após o ensaio remoto |
| E-mail automático de relatórios e retenção de longo prazo | Previsto; não implementado | Dependem de provedor e rotina agendada |
| Sensores, contatores, proteção e bombas físicas | Simulados/propostos; não instalados fisicamente | Ver documentos de componentes, I/O e diagramas |

## Fontes de dados

- **Modo local:** o simulador e seus registros são persistidos em IndexedDB.
- **Modo remoto:** a telemetria do ESP32 é lida do Supabase após login. A
  conexão requer publicação e credenciais externas.
- **Falha remota:** o painel não apresenta telemetria antiga como se estivesse
  ativa; ele retorna à visualização e aos controles do simulador local.
