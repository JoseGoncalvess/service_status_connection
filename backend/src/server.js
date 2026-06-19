require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const MqttService = require('./mqtt/mqttService');

const app = express();
const server = http.createServer(app);

app.use(cors());

// Configuração do Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Rota de verificação de saúde básica
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Inicialização
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BFF Server rodando na porta ${PORT}`);
  
  // Instancia e inicia o serviço MQTT injetando a instância do socket.io
  const mqttService = new MqttService(io);
  mqttService.connect();
});
