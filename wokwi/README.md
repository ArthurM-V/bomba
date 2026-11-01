# Configuracao do ESP32

O firmware le as configuracoes de rede e telemetria em `secrets.h`, que fica
ignorado pelo Git. Para criar esse arquivo, copie `secrets.h.example` e preencha
os valores quando a API Supabase estiver publicada.

Enquanto `API_TELEMETRY_URL`, `DEVICE_API_KEY` ou `TLS_ROOT_CA` estiverem vazios,
o controlador continua executando a simulacao e as protecoes locais, mas nao faz
nenhuma requisicao HTTPS. O Monitor Serial mostrara esse estado uma vez.

Para a simulacao Wokwi, a rede padrao e `Wokwi-GUEST`, sem senha. A funcao HTTPS
nao deve usar `setInsecure()`: copie para `TLS_ROOT_CA` o certificado raiz PEM
da cadeia apresentada pelo dominio da API.

O firmware inclui automaticamente um `bootId` novo a cada inicializacao e uma
sequencia de eventos. Em caso de timeout, ele reenvia o mesmo evento para que a
API nao gere telemetria duplicada.
