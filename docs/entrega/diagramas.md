# Diagramas do sistema

## Diagrama hidráulico

```mermaid
flowchart LR
  REDE[Alimentação de água] --> RI[Reservatório inferior]
  RI -->|Sucção| B1[Bomba B1]
  RI -->|Sucção| B2[Bomba B2]
  B1 -->|Recalque| RS[Reservatório superior]
  B2 -->|Recalque| RS
  RS -->|Consumo predial| EDIF[Edificação]
  NI[Sensor RI] -. nível .-> CTRL[Controlador]
  NS[Sensor RS] -. nível .-> CTRL
```

## Diagrama de comando

```mermaid
flowchart LR
  subgraph Entradas
    NI[Nível RI]
    NS[Nível RS]
    MODO[Auto/manual]
    TESTE[Testes e falhas]
  end
  CTRL[ESP32 / Lógica de controle]
  NI --> CTRL
  NS --> CTRL
  MODO --> CTRL
  TESTE --> CTRL
  CTRL --> R1[Relé B1] --> K1[Contator K1] --> MB1[Motor B1]
  CTRL --> R2[Relé B2] --> K2[Contator K2] --> MB2[Motor B2]
  CTRL --> LED[LED de alarme]
  CTRL --> BUZ[Buzzer]
  CTRL --> OLED[Display OLED]
```

Em instalação física, K1 e K2 devem incluir disjuntor-motor/relé térmico, disjuntor geral, parada de emergência e circuito de comando compatível com as normas aplicáveis. Esses itens são previstos, não uma implementação de potência no Wokwi.

## Arquitetura de comunicação

```mermaid
flowchart LR
  OP[Operador] -->|HTTPS + login| WEB[Painel React]
  WEB -->|Modo local| IDB[(IndexedDB)]
  WEB -->|Modo remoto, HTTPS| API[Supabase API / RLS]
  API --> DB[(Postgres: telemetria e comandos)]
  ESP[ESP32 / Wokwi] -->|POST telemetria HTTPS| API
  ESP -->|GET/POST comandos HTTPS| API
  EMAIL[Serviço de e-mail] -. relatório agendado proposto .-> API
```

O modo local está implementado. O caminho remoto depende de publicação do Supabase, credenciais e validação do ESP32/Wokwi.

## Referência de ligação do protótipo

O diagrama executável de ESP32, display, relés, LEDs, buzzer, potenciômetros e botões está em [`wokwi/diagram.json`](../../wokwi/diagram.json).
