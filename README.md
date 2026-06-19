# Service Status Connection - Monitoramento MQTT em Tempo Real

Esta é uma aplicação Full Stack com a finalidade de se conectar a um Broker MQTT, processar dados de telemetria recebidos (decodificando de Protobuf), analisar as mensagens (verificando latência e monitorando a fila de dados via Watchdog) e enviá-las em tempo real para o Frontend através de WebSockets (Socket.io).

## 🏗️ Arquitetura e Estrutura

O projeto está dividido em dois módulos principais e configurado para rodar nativamente com Docker Compose:

- **Backend (BFF - Backend For Frontend)**:
  - **Porta**: `3000`
  - Desenvolvido em Node.js com Express e Socket.io.
  - Conecta-se ao MQTT (`clientes.passerapido.com.br`).
  - Escuta os tópicos de eventos e comandos.
  - Decodifica os pacotes da telemetria.
  - Provê um *Watchdog Timer* de segurança e tolerância de defasagem (latência).

- **Frontend**:
  - **Porta**: `4200`
  - Desenvolvido com interface reativa que se conecta aos WebSockets do Backend.
  - Consome as emissões de eventos (`telemetry_data`, `watchdog_alert`, `broker_status`).

## ⚙️ Pré-requisitos

Para rodar essa aplicação, você precisará ter instalado em sua máquina:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## 🔑 Configuração de Credenciais

Antes de iniciar os contêineres, é necessário configurar as variáveis de ambiente que permitem a conexão segura com o broker MQTT.

Na pasta `backend/`, verifique se o arquivo `.env` existe e está preenchido com as seguintes credenciais:

```env
# Arquivo: backend/.env
MQTT_BROKER_URL=mqtt://clientes.passerapido.com.br:2883
MQTT_TOPIC_EVENTOS=PARC/EVENTOS
MQTT_TOPIC_COMMANDS=PARCEIRO_COMANDOS
MQTT_CLIENT_ID=parceiro_avl
MQTT_USERNAME=empresa
MQTT_PASSWORD=senha
PORT=3000
WATCHDOG_TIMEOUT_SEC=30
LATENCY_TOLERANCE_SEC=5
```

## 🚀 Como iniciar a Aplicação (Usando Docker)

A maneira mais recomendada de executar a aplicação (devido ao isolamento de dependências e hot-reload já configurado) é usando o **Docker Compose**.

1. Abra o terminal na raiz do projeto (onde está localizado o arquivo `docker-compose.yml`).
2. Execute o comando abaixo para construir as imagens (build) e iniciar os contêineres em segundo plano (-d):

```bash
docker-compose up -d --build
```

### Acessando a aplicação:
- **Frontend**: Após o build finalizar, acesse [http://localhost:4200](http://localhost:4200) no seu navegador.
- **Backend (Healthcheck)**: Pode ser verificado em [http://localhost:3000/health](http://localhost:3000/health).

### Comandos úteis do Docker:

- **Ver os logs em tempo real**:
  ```bash
  docker-compose logs -f
  ```

- **Ver os logs apenas do Backend (para ver status de conexão do MQTT)**:
  ```bash
  docker-compose logs -f backend
  ```

- **Parar a aplicação**:
  ```bash
  docker-compose down
  ```

## 🔍 Regras de Negócio Implementadas

1. **Watchdog de Fila Parada**: Se o backend ficar mais de `WATCHDOG_TIMEOUT_SEC` (padrão de 30 segundos) sem receber uma nova mensagem MQTT, ele emite um alerta (`stalled: true`) de que a fila parou.
2. **Tolerância a Latência (Dados Defasados)**: A aplicação verifica em tempo real o payload (através da chave `latency_seconds`). Se o atraso do dado for maior que `LATENCY_TOLERANCE_SEC` (padrão de 5 segundos), ele emite o dado para o frontend com a flag de alerta ativada (`is_defasado: true`).
