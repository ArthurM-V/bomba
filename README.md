# SCADA de Abastecimento de Água

Primeira versão: simulador hidráulico inteiramente no navegador, sem Wokwi, ESP32 ou backend.

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
