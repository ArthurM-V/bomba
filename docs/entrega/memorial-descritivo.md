# Memorial descritivo — SCADA de abastecimento de água

## Finalidade e escopo

O projeto supervisiona o abastecimento de uma edificação com reservatório inferior (RI), reservatório superior (RS) e duas bombas de recalque (B1 e B2).

O painel React executa um simulador hidráulico local. ESP32/Wokwi e Supabase estão incluídos no repositório, mas dependem de publicação e credenciais.

O painel apresenta níveis, vazões, estados das bombas, relés, contatores, horímetros, partidas, alarmes, tendências, histórico e relatório. A versão local mantém o estado no IndexedDB do navegador.

## Sequência automática

1. O simulador calcula entrada no RI, consumo do RS e transferência por recalque.
2. Quando o RS fica no ponto de partida ou abaixo dele (30% por padrão), é solicitada reposição.
3. A principal semanal é selecionada se disponível: B1 nas primeiras 168 h simuladas, B2 nas 168 h seguintes, repetindo o ciclo.
4. A bomba desliga no ponto de parada do RS (85% por padrão).
5. Se o RI atingir o bloqueio (15%), o recalque para; uma nova partida requer recuperação até 25% por padrão.
6. O recalque é bloqueado no alarme alto do RS (95%) para evitar transbordamento.

## Manual, alternância, testes e falhas

O operador pode ligar B1, B2 ou parar em modo manual. Os intertravamentos não são removidos: RI baixo, RS alto, indisponibilidade, falha de partida e ausência de vazão impedem o comando.

A rotina de teste individual exige modo automático, ausência de demanda, RI em recuperação, RS acima da partida e abaixo de 70%, e bomba disponível. O padrão é 15 min simulados a cada 168 h, alternando B1 e B2 em execuções consecutivas. Duração e intervalo são configuráveis no painel.

O critério definido pelo grupo é: teste **aprovado** quando a bomba parte,
não há ausência de vazão e o RS ganha ao menos **1,0%** durante o ciclo.
Falha de segurança, mudança de modo ou ausência de vazão interrompem/reprovam
o teste. O resultado gera registro e alarme de teste reprovado, mas não marca
automaticamente a bomba como indisponível.

Falha de partida ou indisponibilidade seleciona a reserva quando segura. Sem vazão é alarmada após 10 min simulados, torna a bomba inelegível e permite a transferência para a reserva. A alternância semanal também distribui o uso.

## Alarmes, registros e relatórios

O sistema registra RI baixo, RS alto, falha de partida, indisponibilidade, ausência de vazão, excesso de tempo contínuo ligado e manutenção por horímetro. Cada evento local guarda ocorrência, data/hora, reconhecimento, normalização e hora virtual. São retidos até 100 alarmes e 96 snapshots operacionais.

O CSV contém resumo, parâmetros, horímetros, tempo contínuo, partidas, estados/falhas, alarmes ativos, alarmes históricos e histórico operacional. O navegador permite também impressão ou salvamento como PDF.

## Implementado e previsto

| Recurso | Situação |
|---|---|
| Simulador, intertravamentos, testes, alarmes, tendências e CSV | Implementado localmente |
| Persistência local | Implementada com IndexedDB |
| ESP32/Wokwi, HTTPS, Supabase e comandos remotos | Implementados no repositório; pendentes de configuração/validação ponta a ponta |
| Retorno ao simulador após falha remota | Implementado no painel |
| E-mail automático de relatórios | Previsto; não implementado |
| Sensores, relés, contatores e proteção física | Simulados/propostos; não instalados fisicamente |
