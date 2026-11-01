# SCADA de Abastecimento de Água

O painel atual ainda e um simulador hidraulico no navegador. O repositorio
tambem contem o firmware Wokwi/ESP32 e uma API Supabase de ingestao de
telemetria, ainda sem leitura pelo painel.

## Executar

```powershell
npm install
npm run dev
```

## Escopo atual

- Simulador dos reservatórios inferior e superior.
- Controle automático e manual com intertravamentos.
- Alternância semanal acelerada, falhas, alarmes e horímetros.
- Persistência local via IndexedDB.

O núcleo de domínio em `src/domain/` não depende de React ou IndexedDB. Uma etapa posterior poderá substituir apenas a camada de persistência e conectar telemetria/comandos a Node.js e ESP32.

O escopo, as decisões de persistência e os critérios desta primeira etapa estão em [docs/plano-tecnico.md](docs/plano-tecnico.md).

## Telemetria

As migracoes, a Edge Function e o procedimento de publicacao estao em
[supabase/README.md](supabase/README.md). O firmware fica em `wokwi/`; mantenha
`wokwi/secrets.h` apenas local, pois ele contem a chave do dispositivo.

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
