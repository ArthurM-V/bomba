# SCADA de Abastecimento de Água

O modo principal do painel é um simulador hidráulico local, determinístico e
offline. O repositório também contém firmware Wokwi/ESP32 e integração com
Supabase: após configuração e login do operador, o painel lê telemetria e
envia comandos remotos. Se a conexão remota falhar, a interface retorna ao
simulador local.

## Executar

```powershell
npm install
npm run dev
```

## Escopo atual

- Simulador dos reservatórios inferior e superior.
- Controle automático e manual com intertravamentos.
- Relógio virtual com avanço de 1 hora, 1 dia, 1 semana ou período personalizado; alternância semanal, falhas, alarmes e horímetros.
- Persistência local via IndexedDB.
- Painel remoto por Supabase, condicionado à configuração externa e à
  disponibilidade do ESP32.

O núcleo de domínio em `src/domain/` não depende de React ou IndexedDB. A
persistência local e a leitura remota estão isoladas em serviços próprios.

O escopo, as decisões de persistência e os critérios desta primeira etapa estão em [docs/plano-tecnico.md](docs/plano-tecnico.md).
Consulte também a matriz de [itens implementados e previstos](docs/implementado-previsto.md).

## Telemetria

As migrações, Edge Functions, variáveis do painel e o procedimento de publicação
estão em [supabase/README.md](supabase/README.md). O firmware fica em
`wokwi/`; mantenha `wokwi/secrets.h` apenas local, pois ele contém a chave
do dispositivo.

## Entrega final

- Gráfico de tendência dos níveis no painel.
- Histórico local ou remoto, conforme a origem selecionada.
- Exportação CSV e impressão/salvamento como PDF pelo navegador.
- Roteiro e registro dos cenários obrigatórios em
  [docs/roteiro-testes.md](docs/roteiro-testes.md).

## Documentação da entrega

- [Memorial descritivo](docs/entrega/memorial-descritivo.md)
- [Lista de componentes](docs/entrega/lista-componentes.md)
- [Diagramas](docs/entrega/diagramas.md)
- [Lista de entradas e saídas](docs/entrega/lista-io.md)
- [Relatório de testes](docs/entrega/relatorio-testes.md)
