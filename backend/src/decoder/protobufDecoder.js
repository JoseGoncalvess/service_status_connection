const protobuf = require('protobufjs');
const path = require('path');

class ProtobufDecoder {
  constructor() {
    this.root = null;
    this.AVLEventoMessage = null;
    this.init();
  }

  init() {
    const protoPath = path.resolve(__dirname, '../proto/AVL_Eventos_E1_E1.proto');
    try {
      this.root = protobuf.loadSync(protoPath);
      this.AVLEventoMessage = this.root.lookupType('AVLEvento');
      console.log('✅ Protobuf carregado com sucesso.');
    } catch (err) {
      console.error('❌ Erro ao carregar arquivo .proto:', err);
    }
  }

  decode(buffer) {
    if (!this.AVLEventoMessage) {
      throw new Error('Protobuf não inicializado');
    }

    try {
      // Decodifica o buffer recebido
      const message = this.AVLEventoMessage.decode(buffer);
      // Converte para um objeto plain javascript
      const payload = this.AVLEventoMessage.toObject(message, {
        keepCase: true,
        longs: Number,
        enums: String,
        bytes: String,
        defaults: true, // Garante que campos com valor 0 não sejam removidos
      });

      return this.enrichWithLatency(payload);
    } catch (err) {
      // Como o tópico pode receber mensagens com outros formatos/schemas,
      // logamos apenas a mensagem de erro de forma sucinta para não poluir os logs.
      console.warn(`⚠️ Pacote ignorado (formato inválido para AVLEvento): ${err.message}`);
      console.log('Conteúdo bruto do buffer (UTF-8):', buffer.toString('utf8'));
      return null;
    }
  }

  enrichWithLatency(payload) {
    const OFFSET_2000_SECS = 946684800;
    let unixTimestampSeconds = 0;
    let isLocalTime = false;
    
    const gpsList = payload.avlHeader && payload.avlHeader.gps;
    if (gpsList && gpsList.length > 0) {
      const tsGps = gpsList[0].timestampUtcGeracao || gpsList[0].timestamp_utc_geracao || 0;
      if (tsGps > 0) {
        unixTimestampSeconds = tsGps + OFFSET_2000_SECS;
      }
    }
    
    // Fallback para o horário do validador (local)
    if (unixTimestampSeconds === 0 && payload.avlHeader && payload.avlHeader.validador) {
      const tsValidador = payload.avlHeader.validador.dataHoraValidador || payload.avlHeader.validador.data_hora_validador || 0;
      if (tsValidador > 0) {
        unixTimestampSeconds = tsValidador + OFFSET_2000_SECS;
        isLocalTime = true; // dataHoraValidador é Hora Local (Brasil/UTC-3)
      }
    }

    if (unixTimestampSeconds > 0) {
      let unixTimestampMs = unixTimestampSeconds * 1000;
      
      // Se for hora local (Brasil), precisamos converter pra UTC somando 3 horas 
      // (pois a data já "nasceu" com 3h a menos)
      if (isLocalTime) {
        unixTimestampMs += 10800 * 1000; // +3h em milissegundos
      }
      
      const now = Date.now();
      let latencySec = (now - unixTimestampMs) / 1000;
      
      // Em caso de dessincronia de relógio, previne latências negativas irreais
      if (latencySec < 0 && latencySec > -60) {
        latencySec = 0;
      }
      
      payload._metadata = {
        calculated_unix_ms: unixTimestampMs,
        latency_seconds: latencySec,
        server_received_at_ms: now
      };
    }
    
    return payload;
  }
}

module.exports = new ProtobufDecoder();
