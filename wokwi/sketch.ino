#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_system.h>
#include <time.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include "secrets.h"

// -----------------------------------------------------------------------------
// Identificacao, conectividade e segredos
// -----------------------------------------------------------------------------
// false: o ESP32 calcula o processo hidraulico e os niveis variam sozinhos.
// true: os potenciometros passam a representar sensores de nivel reais.
constexpr bool USE_PHYSICAL_LEVELS = false;

// Perfil de apresentacao: um segundo real equivale a uma hora simulada.
// Para observacao lenta, troque para 60.0F (um segundo = um minuto simulado).
constexpr float SIMULATION_SPEED = 3600.0F;

// -----------------------------------------------------------------------------
// Pinagem - deve permanecer alinhada com wokwi/diagram.json
// -----------------------------------------------------------------------------
constexpr uint8_t PIN_LEVEL_LOWER = 34;
constexpr uint8_t PIN_LEVEL_UPPER = 35;
constexpr uint8_t PIN_RELAY_PUMP_1 = 16;
constexpr uint8_t PIN_RELAY_PUMP_2 = 17;
constexpr uint8_t PIN_CONTACTOR_1 = 18;
constexpr uint8_t PIN_CONTACTOR_2 = 19;
constexpr uint8_t PIN_ALARM_LED = 5;
constexpr uint8_t PIN_BUZZER = 23;
constexpr uint8_t PIN_MODE = 25;
constexpr uint8_t PIN_TEST_PUMP_1 = 26;
constexpr uint8_t PIN_TEST_PUMP_2 = 27;
constexpr uint8_t PIN_START_FAIL_1 = 32;
constexpr uint8_t PIN_START_FAIL_2 = 33;
constexpr uint8_t PIN_NO_FLOW_1 = 13;
constexpr uint8_t PIN_NO_FLOW_2 = 14;
constexpr uint8_t PIN_I2C_SDA = 21;
constexpr uint8_t PIN_I2C_SCL = 22;

Adafruit_SSD1306 display(128, 64, &Wire, -1);

// -----------------------------------------------------------------------------
// Parametros do processo e protecoes
// -----------------------------------------------------------------------------
constexpr float LOWER_CAPACITY_L = 140000.0F;
constexpr float UPPER_CAPACITY_L = 70000.0F;
constexpr float INCOMING_FLOW_LPH = 1200.0F;
constexpr float CONSUMPTION_FLOW_LPH = 1000.0F;
constexpr float PUMP_FLOW_LPH = 7000.0F;

constexpr float UPPER_START_PERCENT = 30.0F;
constexpr float UPPER_STOP_PERCENT = 85.0F;
constexpr float UPPER_PREVENTIVE_PERCENT = 90.0F;
constexpr float UPPER_ALARM_PERCENT = 95.0F;
constexpr float LOWER_WARNING_PERCENT = 20.0F;
constexpr float LOWER_BLOCK_PERCENT = 15.0F;
constexpr float LOWER_RECOVERY_PERCENT = 25.0F;

constexpr float WEEK_HOURS = 168.0F;
constexpr float START_FAILURE_TIMEOUT_H = 5.0F / 60.0F;
constexpr float NO_FLOW_TIMEOUT_H = 10.0F / 60.0F;
constexpr float NO_FLOW_MIN_RISE_PERCENT = 0.5F;
constexpr float LONG_RUN_WARNING_H = 7.0F;
constexpr float LONG_RUN_TRIP_H = 8.0F;
constexpr float MAINTENANCE_HOURS = 100.0F;
constexpr float TEST_DURATION_H = 15.0F / 60.0F;

constexpr unsigned long TELEMETRY_INTERVAL_MS = 5000;
constexpr unsigned long COMMAND_POLL_INTERVAL_MS = 3000;
constexpr unsigned long DISPLAY_INTERVAL_MS = 250;
constexpr unsigned long CLOCK_SYNC_RETRY_MS = 30000;
constexpr char NTP_SERVER_PRIMARY[] = "time.google.com";
constexpr char NTP_SERVER_SECONDARY[] = "pool.ntp.org";

enum class OperationMode : uint8_t { Auto, Manual };

struct PumpState {
  bool command = false;
  bool running = false;
  bool startFailureInjected = false;
  bool noFlowInjected = false;
  bool startFailureDetected = false;
  bool noFlowDetected = false;
  bool longRunTripDetected = false;
  float runHours = 0.0F;
  uint32_t starts = 0;
  float commandStartedAt = -1.0F;
  float continuousRunStartedAt = -1.0F;
  float flowCheckStartedAt = -1.0F;
  float flowCheckInitialLevel = 0.0F;
};

struct PlantState {
  float lowerLevel = 82.0F;
  float upperLevel = 48.0F;
  float virtualHours = 0.0F;
  bool fillRequest = false;
  OperationMode mode = OperationMode::Auto;
  uint8_t leadPump = 1;
  uint8_t commandedPump = 0;
  uint8_t manualPump = 0;
  uint8_t testPump = 0;
  float testStartedAt = -1.0F;
  uint8_t scheduledTestStep = 0;
  float nextScheduledTestAt = WEEK_HOURS;
  PumpState pumps[2];
};

PlantState plant;

bool previousButtonState[8] = {false};
bool telemetryPending = true;
bool telemetryRetryPending = false;
unsigned long lastLoopMs = 0;
unsigned long lastTelemetryMs = 0;
unsigned long lastCommandPollMs = 0;
unsigned long lastDisplayMs = 0;
unsigned long lastClockSyncAttemptMs = 0;
bool telemetryConfigurationWarningSent = false;
bool clockSynchronized = false;
String telemetryBootId;
uint32_t telemetrySequence = 0;
String lastExecutedCommandId;
String lastCommandResult;
String lastCommandStatus;

// -----------------------------------------------------------------------------
// Utilitarios
// -----------------------------------------------------------------------------
float clampPercent(float value) {
  return constrain(value, 0.0F, 100.0F);
}

const char* modeLabel() {
  return plant.mode == OperationMode::Auto ? "AUTO" : "MANUAL";
}

const char* pumpLabel(uint8_t pump) {
  if (pump == 1) return "B1";
  if (pump == 2) return "B2";
  return "--";
}

float readLevelPercent(uint8_t pin) {
  return clampPercent((static_cast<float>(analogRead(pin)) / 4095.0F) * 100.0F);
}

bool isPressed(uint8_t pin, uint8_t index) {
  const bool pressed = digitalRead(pin) == LOW;
  const bool edge = pressed && !previousButtonState[index];
  previousButtonState[index] = pressed;
  return edge;
}

bool pumpEligible(uint8_t pump) {
  const PumpState& state = plant.pumps[pump - 1];
  return !state.startFailureDetected && !state.noFlowDetected && !state.longRunTripDetected;
}

bool hasCriticalAlarm() {
  return plant.lowerLevel <= LOWER_BLOCK_PERCENT ||
         plant.upperLevel >= UPPER_ALARM_PERCENT ||
         plant.pumps[0].startFailureDetected ||
         plant.pumps[0].noFlowDetected ||
         plant.pumps[0].longRunTripDetected ||
         plant.pumps[1].startFailureDetected ||
         plant.pumps[1].noFlowDetected ||
         plant.pumps[1].longRunTripDetected;
}

bool isSafeForTest() {
  return plant.lowerLevel >= LOWER_RECOVERY_PERCENT &&
         plant.upperLevel < 70.0F &&
         !plant.fillRequest &&
         plant.upperLevel < UPPER_ALARM_PERCENT;
}

void logEvent(const String& message) {
  Serial.printf("[%.2f h] %s\n", plant.virtualHours, message.c_str());
  telemetryPending = true;
}

// -----------------------------------------------------------------------------
// Entradas de operacao e de falha
// -----------------------------------------------------------------------------
void handleInputs() {
  if (isPressed(PIN_MODE, 0)) {
    plant.mode = plant.mode == OperationMode::Auto ? OperationMode::Manual : OperationMode::Auto;
    plant.manualPump = 0;
    if (plant.mode == OperationMode::Manual) plant.testPump = 0;
    logEvent(String("Modo alterado para ") + modeLabel());
  }

  if (isPressed(PIN_TEST_PUMP_1, 1)) {
    if (plant.mode == OperationMode::Manual) {
      plant.manualPump = plant.manualPump == 1 ? 0 : 1;
      logEvent(String("Comando manual B1: ") + (plant.manualPump == 1 ? "LIGAR" : "DESLIGAR"));
    } else {
      plant.testPump = 1;
      plant.testStartedAt = -1.0F;
      logEvent("Teste manual solicitado para B1");
    }
  }

  if (isPressed(PIN_TEST_PUMP_2, 2)) {
    if (plant.mode == OperationMode::Manual) {
      plant.manualPump = plant.manualPump == 2 ? 0 : 2;
      logEvent(String("Comando manual B2: ") + (plant.manualPump == 2 ? "LIGAR" : "DESLIGAR"));
    } else {
      plant.testPump = 2;
      plant.testStartedAt = -1.0F;
      logEvent("Teste manual solicitado para B2");
    }
  }

  if (isPressed(PIN_START_FAIL_1, 3)) {
    PumpState& pump = plant.pumps[0];
    pump.startFailureInjected = !pump.startFailureInjected;
    if (!pump.startFailureInjected) pump.startFailureDetected = false;
    logEvent(String("Injecao de falha de partida B1: ") + (pump.startFailureInjected ? "ATIVA" : "LIMPA"));
  }

  if (isPressed(PIN_START_FAIL_2, 4)) {
    PumpState& pump = plant.pumps[1];
    pump.startFailureInjected = !pump.startFailureInjected;
    if (!pump.startFailureInjected) pump.startFailureDetected = false;
    logEvent(String("Injecao de falha de partida B2: ") + (pump.startFailureInjected ? "ATIVA" : "LIMPA"));
  }

  if (isPressed(PIN_NO_FLOW_1, 5)) {
    PumpState& pump = plant.pumps[0];
    pump.noFlowInjected = !pump.noFlowInjected;
    if (!pump.noFlowInjected) pump.noFlowDetected = false;
    logEvent(String("Injecao de sem vazao B1: ") + (pump.noFlowInjected ? "ATIVA" : "LIMPA"));
  }

  if (isPressed(PIN_NO_FLOW_2, 6)) {
    PumpState& pump = plant.pumps[1];
    pump.noFlowInjected = !pump.noFlowInjected;
    if (!pump.noFlowInjected) pump.noFlowDetected = false;
    logEvent(String("Injecao de sem vazao B2: ") + (pump.noFlowInjected ? "ATIVA" : "LIMPA"));
  }
}

// -----------------------------------------------------------------------------
// Controle de processo
// -----------------------------------------------------------------------------
void updateFillRequest() {
  if (plant.upperLevel <= UPPER_START_PERCENT) plant.fillRequest = true;
  if (plant.upperLevel >= UPPER_STOP_PERCENT) plant.fillRequest = false;
  if (plant.lowerLevel <= LOWER_BLOCK_PERCENT) plant.fillRequest = false;
  if (plant.upperLevel >= UPPER_ALARM_PERCENT) plant.fillRequest = false;
}

void updateScheduledTest() {
  if (plant.mode != OperationMode::Auto || plant.virtualHours < plant.nextScheduledTestAt || plant.testPump != 0) return;
  if (!isSafeForTest()) return;

  plant.testPump = plant.scheduledTestStep == 0 ? 1 : 2;
  plant.testStartedAt = -1.0F;
  logEvent(String("Teste semanal iniciado: ") + pumpLabel(plant.testPump));
}

uint8_t selectPump() {
  if (plant.lowerLevel <= LOWER_BLOCK_PERCENT || plant.upperLevel >= UPPER_ALARM_PERCENT) {
    return 0;
  }

  if (plant.mode == OperationMode::Manual) {
    return plant.manualPump != 0 && pumpEligible(plant.manualPump) ? plant.manualPump : 0;
  }

  if (plant.testPump != 0) {
    if (!isSafeForTest() || !pumpEligible(plant.testPump)) {
      logEvent("Teste cancelado por condicao insegura ou bomba indisponivel");
      plant.testPump = 0;
      return 0;
    }
    if (plant.testStartedAt < 0.0F) plant.testStartedAt = plant.virtualHours;
    if (plant.virtualHours - plant.testStartedAt >= TEST_DURATION_H) {
      const uint8_t completedPump = plant.testPump;
      plant.testPump = 0;
      plant.testStartedAt = -1.0F;
      logEvent(String("Teste concluido: ") + pumpLabel(completedPump));

      if (plant.virtualHours >= plant.nextScheduledTestAt) {
        if (plant.scheduledTestStep == 0) {
          plant.scheduledTestStep = 1;
        } else {
          plant.scheduledTestStep = 0;
          plant.nextScheduledTestAt = plant.virtualHours + WEEK_HOURS;
          logEvent("Rotina semanal de testes concluida");
        }
      }
      return 0;
    }
    return plant.testPump;
  }

  if (!plant.fillRequest) return 0;

  const uint8_t reservePump = plant.leadPump == 1 ? 2 : 1;
  if (pumpEligible(plant.leadPump)) return plant.leadPump;
  if (pumpEligible(reservePump)) return reservePump;
  return 0;
}

void applyPumpCommand(uint8_t selectedPump, float dtHours) {
  plant.commandedPump = selectedPump;

  for (uint8_t index = 0; index < 2; index++) {
    PumpState& pump = plant.pumps[index];
    const uint8_t pumpId = index + 1;
    const bool commanded = selectedPump == pumpId;
    const bool wasCommanded = pump.command;
    pump.command = commanded;

    if (commanded && !wasCommanded) {
      pump.starts++;
      pump.commandStartedAt = plant.virtualHours;
      pump.continuousRunStartedAt = plant.virtualHours;
      pump.flowCheckStartedAt = plant.virtualHours;
      pump.flowCheckInitialLevel = plant.upperLevel;
      logEvent(String("Comando de partida ") + pumpLabel(pumpId));
    }

    if (!commanded) {
      pump.running = false;
      pump.commandStartedAt = -1.0F;
      pump.continuousRunStartedAt = -1.0F;
      pump.flowCheckStartedAt = -1.0F;
      continue;
    }

    pump.running = !pump.startFailureInjected;
    if (!pump.running && pump.commandStartedAt >= 0.0F &&
        plant.virtualHours - pump.commandStartedAt >= START_FAILURE_TIMEOUT_H) {
      if (!pump.startFailureDetected) {
        pump.startFailureDetected = true;
        logEvent(String("ALARME: falha de partida ") + pumpLabel(pumpId));
      }
    }

    if (pump.running) {
      pump.runHours += dtHours;
      if (pump.noFlowInjected && pump.flowCheckStartedAt >= 0.0F &&
          plant.virtualHours - pump.flowCheckStartedAt >= NO_FLOW_TIMEOUT_H &&
          plant.upperLevel - pump.flowCheckInitialLevel < NO_FLOW_MIN_RISE_PERCENT) {
        if (!pump.noFlowDetected) {
          pump.noFlowDetected = true;
          logEvent(String("ALARME: ausencia de elevacao de nivel em ") + pumpLabel(pumpId));
        }
      }
    }
  }
}

void updateHydraulicModel(float dtHours) {
  if (USE_PHYSICAL_LEVELS) {
    plant.lowerLevel = readLevelPercent(PIN_LEVEL_LOWER);
    plant.upperLevel = readLevelPercent(PIN_LEVEL_UPPER);
    return;
  }

  float pumpedFlow = 0.0F;
  if (plant.commandedPump != 0) {
    const PumpState& activePump = plant.pumps[plant.commandedPump - 1];
    if (activePump.running && !activePump.noFlowInjected) pumpedFlow = PUMP_FLOW_LPH;
  }

  plant.lowerLevel = clampPercent(plant.lowerLevel +
    ((INCOMING_FLOW_LPH - pumpedFlow) * dtHours / LOWER_CAPACITY_L) * 100.0F);
  plant.upperLevel = clampPercent(plant.upperLevel +
    ((pumpedFlow - CONSUMPTION_FLOW_LPH) * dtHours / UPPER_CAPACITY_L) * 100.0F);
}

void updateControl(float dtHours) {
  plant.virtualHours += dtHours;
  plant.leadPump = (static_cast<uint32_t>(plant.virtualHours / WEEK_HOURS) % 2 == 0) ? 1 : 2;

  updateFillRequest();
  updateScheduledTest();
  const uint8_t selectedPump = selectPump();
  applyPumpCommand(selectedPump, dtHours);
  updateHydraulicModel(dtHours);

  if (plant.commandedPump != 0) {
    PumpState& active = plant.pumps[plant.commandedPump - 1];
    const float continuousRunHours = active.continuousRunStartedAt < 0.0F
      ? 0.0F
      : plant.virtualHours - active.continuousRunStartedAt;
    if (active.running && continuousRunHours >= LONG_RUN_TRIP_H && !active.longRunTripDetected) {
      active.longRunTripDetected = true;
      logEvent(String("ALARME: desligamento por tempo maximo em ") + pumpLabel(plant.commandedPump));
    } else if (active.running && continuousRunHours >= LONG_RUN_WARNING_H) {
      // O aviso entra na telemetria por meio do campo de alarmes.
      telemetryPending = true;
    }
  }
}

// -----------------------------------------------------------------------------
// Saidas, tela e telemetria
// -----------------------------------------------------------------------------
bool hasAlarm() {
  if (hasCriticalAlarm()) return true;
  if (plant.upperLevel >= UPPER_PREVENTIVE_PERCENT || plant.lowerLevel <= LOWER_WARNING_PERCENT) return true;
  for (const PumpState& pump : plant.pumps) {
    const float continuousRunHours = pump.continuousRunStartedAt < 0.0F
      ? 0.0F
      : plant.virtualHours - pump.continuousRunStartedAt;
    if (continuousRunHours >= LONG_RUN_WARNING_H || pump.runHours >= MAINTENANCE_HOURS) return true;
  }
  return false;
}

bool isTelemetryConfigured() {
  return strlen(API_TELEMETRY_URL) > 0 &&
         strlen(DEVICE_API_KEY) >= 32 &&
         strlen(TLS_ROOT_CA) >= 200;
}

bool isRemoteCommandsConfigured() {
  return isTelemetryConfigured() && strlen(DEVICE_COMMANDS_URL) > 0;
}

void printTelemetryConfigurationStatus() {
  Serial.printf(
    "Configuracao HTTPS: URL=%s, chave=%s, CA=%s.\n",
    strlen(API_TELEMETRY_URL) > 0 ? "ok" : "ausente",
    strlen(DEVICE_API_KEY) >= 32 ? "ok" : "ausente/curta",
    strlen(TLS_ROOT_CA) >= 200 ? "ok" : "ausente/incompleta"
  );
}

void updateOutputs() {
  const bool pump1Commanded = plant.pumps[0].command;
  const bool pump2Commanded = plant.pumps[1].command;
  const bool alarm = hasAlarm();

  digitalWrite(PIN_RELAY_PUMP_1, pump1Commanded ? HIGH : LOW);
  digitalWrite(PIN_RELAY_PUMP_2, pump2Commanded ? HIGH : LOW);
  digitalWrite(PIN_CONTACTOR_1, plant.pumps[0].running ? HIGH : LOW);
  digitalWrite(PIN_CONTACTOR_2, plant.pumps[1].running ? HIGH : LOW);
  digitalWrite(PIN_ALARM_LED, alarm ? HIGH : LOW);

  const bool buzzerOn = alarm && ((millis() / 500) % 2 == 0);
  if (buzzerOn) tone(PIN_BUZZER, 1600);
  else noTone(PIN_BUZZER);
}

String alarmSummary() {
  String alarms;
  if (plant.lowerLevel <= LOWER_BLOCK_PERCENT) alarms += "LOWER_BLOCK|";
  if (plant.upperLevel >= UPPER_ALARM_PERCENT) alarms += "UPPER_HIGH_HIGH|";
  if (plant.pumps[0].startFailureDetected) alarms += "START_FAIL_B1|";
  if (plant.pumps[1].startFailureDetected) alarms += "START_FAIL_B2|";
  if (plant.pumps[0].noFlowDetected) alarms += "NO_FLOW_B1|";
  if (plant.pumps[1].noFlowDetected) alarms += "NO_FLOW_B2|";
  if (plant.pumps[0].longRunTripDetected) alarms += "LONG_RUN_B1|";
  if (plant.pumps[1].longRunTripDetected) alarms += "LONG_RUN_B2|";
  if (alarms.length() == 0) alarms = "NONE";
  return alarms;
}

String createTelemetryBootId() {
  char value[32];
  snprintf(
    value,
    sizeof(value),
    "%012llX-%08lX",
    static_cast<unsigned long long>(ESP.getEfuseMac()),
    static_cast<unsigned long>(esp_random())
  );
  return String(value);
}

String buildTelemetryPayload(uint32_t eventSequence) {
  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"bootId\":\"" + telemetryBootId + "\",";
  payload += "\"eventSequence\":" + String(eventSequence) + ",";
  payload += "\"timestampMs\":" + String(millis()) + ",";
  payload += "\"virtualHours\":" + String(plant.virtualHours, 3) + ",";
  payload += "\"lowerLevel\":" + String(plant.lowerLevel, 2) + ",";
  payload += "\"upperLevel\":" + String(plant.upperLevel, 2) + ",";
  payload += "\"mode\":\"" + String(modeLabel()) + "\",";
  payload += "\"leadPump\":" + String(plant.leadPump) + ",";
  payload += "\"manualPump\":" + String(plant.manualPump) + ",";
  payload += "\"commandedPump\":" + String(plant.commandedPump) + ",";
  payload += "\"alarms\":\"" + alarmSummary() + "\",";
  payload += "\"pumps\":[";
  for (uint8_t index = 0; index < 2; index++) {
    const PumpState& pump = plant.pumps[index];
    if (index > 0) payload += ",";
    payload += "{\"id\":" + String(index + 1) +
               ",\"command\":" + String(pump.command ? "true" : "false") +
               ",\"running\":" + String(pump.running ? "true" : "false") +
               ",\"runHours\":" + String(pump.runHours, 3) +
               ",\"starts\":" + String(pump.starts) + "}";
  }
  payload += "]}";
  return payload;
}

void sendTelemetryIfDue() {
  const bool due = millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS;
  // Events are sent without waiting for the next interval. A failed request,
  // however, must wait for the interval before retrying; otherwise a transient
  // connection loss creates a tight HTTPS loop that starves command polling.
  const bool eventPending = telemetryPending && !telemetryRetryPending;
  if (!due && !eventPending) return;
  lastTelemetryMs = millis();

  if (!isTelemetryConfigured()) {
    if (!telemetryConfigurationWarningSent) {
      Serial.println("Telemetria HTTPS desativada: configure URL, chave de 32+ caracteres e CA TLS em secrets.h.");
      printTelemetryConfigurationStatus();
      telemetryConfigurationWarningSent = true;
    }
    telemetryPending = false;
    telemetryRetryPending = false;
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Telemetria adiada: Wi-Fi desconectado.");
    telemetryPending = true;
    telemetryRetryPending = true;
    return;
  }

  if (!clockSynchronized) {
    telemetryPending = true;
    telemetryRetryPending = true;
    return;
  }

  WiFiClientSecure secureClient;
  secureClient.setCACert(TLS_ROOT_CA);
  HTTPClient http;
  if (!http.begin(secureClient, API_TELEMETRY_URL)) {
    Serial.println("Falha ao iniciar cliente HTTPS.");
    telemetryPending = true;
    telemetryRetryPending = true;
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  const int statusCode = http.POST(buildTelemetryPayload(telemetrySequence));
  Serial.printf("HTTPS POST /telemetry: %d\n", statusCode);
  http.end();
  telemetryPending = statusCode < 200 || statusCode >= 300;
  telemetryRetryPending = telemetryPending;
  if (!telemetryPending) telemetrySequence++;
}

bool sendCommandAcknowledgement(const String& commandId, const char* status, const String& result) {
  WiFiClientSecure secureClient;
  secureClient.setCACert(TLS_ROOT_CA);
  HTTPClient http;
  if (!http.begin(secureClient, DEVICE_COMMANDS_URL)) return false;

  StaticJsonDocument<384> payload;
  payload["commandId"] = commandId;
  payload["status"] = status;
  payload["result"] = result;
  String body;
  serializeJson(payload, body);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.addHeader("X-Device-ID", DEVICE_ID);
  const int statusCode = http.POST(body);
  http.end();
  Serial.printf("HTTPS POST /device-commands: %d\n", statusCode);
  return statusCode >= 200 && statusCode < 300;
}

bool executeRemoteCommand(JsonObject command, String& result) {
  const char* action = command["action"] | "";
  JsonObject payload = command["payload"].as<JsonObject>();

  if (strcmp(action, "set_mode") == 0) {
    const char* mode = payload["mode"] | "";
    if (strcmp(mode, "auto") == 0) {
      plant.mode = OperationMode::Auto;
      plant.manualPump = 0;
      logEvent("Comando remoto: modo automatico");
      result = "Modo automatico aplicado.";
      return true;
    }
    if (strcmp(mode, "manual") == 0) {
      plant.mode = OperationMode::Manual;
      plant.manualPump = 0;
      plant.testPump = 0;
      logEvent("Comando remoto: modo manual");
      result = "Modo manual aplicado.";
      return true;
    }
    result = "Modo invalido.";
    return false;
  }

  if (strcmp(action, "set_manual_pump") == 0) {
    const int pump = payload["pump"] | -1;
    if (plant.mode != OperationMode::Manual) {
      result = "Comando manual rejeitado: modo automatico ativo.";
      return false;
    }
    if (pump < 0 || pump > 2) {
      result = "Bomba manual invalida.";
      return false;
    }
    if (pump != 0 && (plant.lowerLevel <= LOWER_BLOCK_PERCENT || plant.upperLevel >= UPPER_ALARM_PERCENT)) {
      result = "Comando bloqueado por intertravamento de nivel.";
      return false;
    }
    if (pump != 0 && !pumpEligible(static_cast<uint8_t>(pump))) {
      result = "Bomba indisponivel para operacao manual.";
      return false;
    }
    plant.manualPump = static_cast<uint8_t>(pump);
    logEvent(String("Comando remoto manual: ") + pumpLabel(plant.manualPump));
    result = pump == 0 ? "Parada manual aplicada." : "Comando manual aplicado.";
    return true;
  }

  if (strcmp(action, "run_test") == 0) {
    const int pump = payload["pump"] | 0;
    if (plant.mode != OperationMode::Auto) {
      result = "Teste rejeitado: selecione modo automatico.";
      return false;
    }
    if ((pump != 1 && pump != 2) || !pumpEligible(static_cast<uint8_t>(pump))) {
      result = "Bomba indisponivel para teste.";
      return false;
    }
    if (!isSafeForTest()) {
      result = "Teste bloqueado pelas condicoes de seguranca.";
      return false;
    }
    plant.testPump = static_cast<uint8_t>(pump);
    plant.testStartedAt = -1.0F;
    logEvent(String("Teste remoto solicitado: ") + pumpLabel(plant.testPump));
    result = "Teste iniciado.";
    return true;
  }

  result = "Acao desconhecida.";
  return false;
}

void pollRemoteCommandsIfDue() {
  if (!isRemoteCommandsConfigured() || WiFi.status() != WL_CONNECTED || !clockSynchronized) return;
  if (millis() - lastCommandPollMs < COMMAND_POLL_INTERVAL_MS) return;
  lastCommandPollMs = millis();

  WiFiClientSecure secureClient;
  secureClient.setCACert(TLS_ROOT_CA);
  HTTPClient http;
  const String url = String(DEVICE_COMMANDS_URL) + "?deviceId=" + DEVICE_ID;
  if (!http.begin(secureClient, url)) return;
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  const int statusCode = http.GET();
  if (statusCode != 200) {
    Serial.printf("HTTPS GET /device-commands: %d\n", statusCode);
    http.end();
    return;
  }

  StaticJsonDocument<2048> document;
  const DeserializationError parseError = deserializeJson(document, http.getString());
  http.end();
  if (parseError || !document["commands"].is<JsonArray>()) {
    Serial.println("Resposta de comandos invalida.");
    return;
  }

  for (JsonObject command : document["commands"].as<JsonArray>()) {
    const String commandId = command["id"].as<String>();
    if (commandId.length() == 0) continue;

    String result;
    const char* resultStatus;
    if (commandId == lastExecutedCommandId) {
      result = lastCommandResult;
      resultStatus = lastCommandStatus.c_str();
    } else {
      const bool executed = executeRemoteCommand(command, result);
      resultStatus = executed ? "executed" : "rejected";
      lastExecutedCommandId = commandId;
      lastCommandResult = result;
      lastCommandStatus = resultStatus;
    }
    sendCommandAcknowledgement(commandId, resultStatus, result);
  }
}

void updateDisplayIfDue() {
  if (millis() - lastDisplayMs < DISPLAY_INTERVAL_MS) return;
  lastDisplayMs = millis();

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.printf("SCADA AGUA  %s", modeLabel());
  display.setCursor(0, 14);
  display.printf("RI: %5.1f%%", plant.lowerLevel);
  display.setCursor(0, 25);
  display.printf("RS: %5.1f%%", plant.upperLevel);
  display.setCursor(0, 36);
  display.printf("Principal: %s", pumpLabel(plant.leadPump));
  display.setCursor(0, 47);
  display.printf("Ativa: %s  t:%5.1fh", pumpLabel(plant.commandedPump), plant.virtualHours);
  display.setCursor(0, 57);
  display.print(hasAlarm() ? "ALARME ATIVO" : "Processo normal");
  display.display();
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
  Serial.printf("Conectando ao Wi-Fi %s", WIFI_SSID);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 10000) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi conectado. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi indisponivel; o controle local continua ativo.");
  }
}

bool synchronizeClock() {
  if (WiFi.status() != WL_CONNECTED) return false;

  lastClockSyncAttemptMs = millis();
  configTime(0, 0, NTP_SERVER_PRIMARY, NTP_SERVER_SECONDARY);
  tm timeInfo;
  if (!getLocalTime(&timeInfo, 10000)) {
    Serial.println("NTP indisponivel; requisicoes HTTPS aguardam relogio valido.");
    return false;
  }

  clockSynchronized = true;
  Serial.printf(
    "Relogio NTP sincronizado: %04d-%02d-%02d %02d:%02d:%02d UTC\n",
    timeInfo.tm_year + 1900,
    timeInfo.tm_mon + 1,
    timeInfo.tm_mday,
    timeInfo.tm_hour,
    timeInfo.tm_min,
    timeInfo.tm_sec
  );
  return true;
}

void synchronizeClockIfNeeded() {
  if (clockSynchronized || WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastClockSyncAttemptMs < CLOCK_SYNC_RETRY_MS) return;
  synchronizeClock();
}

void setup() {
  Serial.begin(115200);
  telemetryBootId = createTelemetryBootId();

  pinMode(PIN_RELAY_PUMP_1, OUTPUT);
  pinMode(PIN_RELAY_PUMP_2, OUTPUT);
  pinMode(PIN_CONTACTOR_1, OUTPUT);
  pinMode(PIN_CONTACTOR_2, OUTPUT);
  pinMode(PIN_ALARM_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  const uint8_t inputPins[] = {
    PIN_MODE, PIN_TEST_PUMP_1, PIN_TEST_PUMP_2, PIN_START_FAIL_1,
    PIN_START_FAIL_2, PIN_NO_FLOW_1, PIN_NO_FLOW_2
  };
  for (uint8_t pin : inputPins) pinMode(pin, INPUT_PULLUP);

  analogReadResolution(12);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);

  digitalWrite(PIN_RELAY_PUMP_1, LOW);
  digitalWrite(PIN_RELAY_PUMP_2, LOW);
  digitalWrite(PIN_CONTACTOR_1, LOW);
  digitalWrite(PIN_CONTACTOR_2, LOW);
  digitalWrite(PIN_ALARM_LED, LOW);

  if (USE_PHYSICAL_LEVELS) {
    plant.lowerLevel = readLevelPercent(PIN_LEVEL_LOWER);
    plant.upperLevel = readLevelPercent(PIN_LEVEL_UPPER);
  }

  connectWifi();
  synchronizeClock();
  lastLoopMs = millis();
  logEvent("Controlador iniciado");
}

void loop() {
  const unsigned long now = millis();
  const float dtHours = ((now - lastLoopMs) / 1000.0F) * (SIMULATION_SPEED / 3600.0F);
  lastLoopMs = now;

  handleInputs();
  synchronizeClockIfNeeded();
  pollRemoteCommandsIfDue();
  updateControl(dtHours);
  updateOutputs();
  updateDisplayIfDue();
  sendTelemetryIfDue();
}
