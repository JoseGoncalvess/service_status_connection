const mqtt = require('mqtt');
const protobufDecoder = require('../decoder/protobufDecoder');

class MqttService {
  constructor(io) {
    this.io = io;
    this.client = null;
    this.watchdogTimer = null;
    this.offlineTimer = null;

    // Configurações vindas das variáveis de ambiente ou com defaults
    this.brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://clientes.passerapido.com.br:2883';
    this.topicEventos = process.env.MQTT_TOPIC_EVENTOS || 'PARC/EVENTOS';
    this.topicCommands = process.env.MQTT_TOPIC_COMMANDS || 'PARCEIRO_COMANDOS';

    this.mqttClientId = process.env.MQTT_CLIENT_ID || 'parceiro_avl';
    this.mqttUsername = process.env.MQTT_USERNAME || 'empresa';
    this.mqttPassword = process.env.MQTT_PASSWORD || 'senha';

    this.watchdogTimeoutSec = parseInt(process.env.WATCHDOG_TIMEOUT_SEC || '30', 10);
    this.latencyToleranceSec = parseInt(process.env.LATENCY_TOLERANCE_SEC || '5', 10);

    this.isConnected = false;
  }

  connect() {
    console.log(`🔌 Conectando ao broker MQTT em ${this.brokerUrl}...`);
    this.client = mqtt.connect(this.brokerUrl, {
      qos: 2,
      clean: true,
      clientId: this.mqttClientId,
      username: this.mqttUsername,
      password: this.mqttPassword,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    });

    this.setupListeners();
  }

  setupListeners() {
    this.client.on('connect', () => {
      console.log('🟢 Conectado ao broker MQTT.');
      this.isConnected = true;
      if (this.offlineTimer) {
        clearTimeout(this.offlineTimer);
        this.offlineTimer = null;
      }
      this.io.emit('broker_status', { connected: true });

      // Assina os tópicos
      this.client.subscribe([this.topicEventos, this.topicCommands], { qos: 2 }, (err) => {
        if (!err) {
          console.log(`📡 Assinado nos tópicos: ${this.topicEventos}, ${this.topicCommands}`);
          this.resetWatchdog(); // Inicia o watchdog ao assinar
        } else {
          console.error('❌ Erro ao assinar tópico:', err);
        }
      });
    });

    this.client.on('offline', () => {
      console.log('🔴 Broker MQTT offline.');
      if (!this.offlineTimer) {
        this.offlineTimer = setTimeout(() => {
          this.isConnected = false;
          this.io.emit('broker_status', { connected: false });
        }, 15000); // 15 segundos de tolerância
      }
    });

    this.client.on('error', (err) => {
      console.error('❌ Erro no MQTT:', err);
      if (!this.offlineTimer) {
        this.offlineTimer = setTimeout(() => {
          this.isConnected = false;
          this.io.emit('broker_status', { connected: false });
        }, 15000); // 15 segundos de tolerância
      }
    });

    this.client.on('message', (topic, message) => {
      // message é um Buffer
      this.handleMessage(topic, message);
    });

    // Quando um cliente Socket.io conecta, enviamos o status atual imediatamente
    this.io.on('connection', (socket) => {
      console.log(`👤 Cliente conectado no Socket.io: ${socket.id}`);
      socket.emit('broker_status', { connected: this.isConnected });
    });
  }

  handleMessage(topic, buffer) {
    // 1. Reinicia o Watchdog Timer (pois chegou mensagem)
    this.resetWatchdog();
    this.io.emit('watchdog_alert', { stalled: false });

    if (topic === this.topicEventos) {
      // 2. Decodifica e aplica regras matemáticas
      const payload = protobufDecoder.decode(buffer);
      if (payload) {
        // 3. Checa a regra de "Dados Defasados"
        let defasado = false;
        if (payload._metadata && payload._metadata.latency_seconds > this.latencyToleranceSec) {
          defasado = true;
        }

        // 4. Emite para o Frontend
        this.io.emit('telemetry_data', {
          payload,
          is_defasado: defasado
        });
      }
    } else {
      console.log(`Mensagem recebida no tópico ${topic}`);
    }
  }

  resetWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
    }

    this.watchdogTimer = setTimeout(() => {
      console.warn(`⚠️ Alerta: Fila Parada (Watchdog estourou - ${this.watchdogTimeoutSec}s sem dados)`);
      this.io.emit('watchdog_alert', { stalled: true });
    }, this.watchdogTimeoutSec * 1000);
  }
}

module.exports = MqttService;
