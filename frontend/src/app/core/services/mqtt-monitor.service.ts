import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface TelemetryData {
  payload: any;
  is_defasado: boolean;
}

export interface VehicleState {
  id: string;
  lat: number;
  lon: number;
  velocidade: number;
  ignicao: boolean;
  is_defasado: boolean;
  updatedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class MqttMonitorService {
  private socket: Socket;

  // Estado Reativo
  private brokerStatusSubject = new BehaviorSubject<boolean>(false);
  private watchdogAlertSubject = new BehaviorSubject<boolean>(true); // Começa como true (esperando dados)
  private telemetryDataSubject = new BehaviorSubject<TelemetryData | null>(null);
  private logsSubject = new BehaviorSubject<TelemetryData[]>([]);
  private latencyHistorySubject = new BehaviorSubject<number[]>([]);
  private activeVehiclesSubject = new BehaviorSubject<VehicleState[]>([]);

  brokerStatus$ = this.brokerStatusSubject.asObservable();
  watchdogAlert$ = this.watchdogAlertSubject.asObservable();
  telemetryData$ = this.telemetryDataSubject.asObservable();
  logs$ = this.logsSubject.asObservable();
  latencyHistory$ = this.latencyHistorySubject.asObservable();
  activeVehicles$ = this.activeVehiclesSubject.asObservable();

  constructor() {
    // Conecta ao BFF rodando na porta 3000
    this.socket = io('http://localhost:3000');

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('broker_status', (data: { connected: boolean }) => {
      this.brokerStatusSubject.next(data.connected);
    });

    this.socket.on('watchdog_alert', (data: { stalled: boolean }) => {
      this.watchdogAlertSubject.next(data.stalled);
    });

    this.socket.on('telemetry_data', (data: TelemetryData) => {
      this.telemetryDataSubject.next(data);
      
      const currentLogs = this.logsSubject.getValue();
      const newLogs = [data, ...currentLogs].slice(0, 50);
      this.logsSubject.next(newLogs);

      // Atualiza Histórico de Latência (últimas 30 amostras)
      const latencySec = data.payload?._metadata?.latency_seconds || 0;
      const currentLatency = this.latencyHistorySubject.getValue();
      const newLatency = [...currentLatency, latencySec].slice(-30);
      this.latencyHistorySubject.next(newLatency);

      // Atualiza Veículos Ativos
      this.updateActiveVehicles(data);
    });
  }

  private updateActiveVehicles(data: TelemetryData) {
    const payload = data.payload;
    const header = payload?.avlHeader;
    if (!header) return;

    const validador = header.validador;
    const modem = header.modem;
    
    // Tratamento para usar o prefixo do veículo
    let id = validador?.prefixoVeiculo || validador?.prefixo_veiculo;
    if (id && typeof id === 'string') id = id.trim();
    if (!id && validador?.codVeiculo) id = validador.codVeiculo;
    if (!id && validador?.cod_veiculo) id = validador.cod_veiculo;
    if (!id && modem?.imei) id = modem.imei;
    if (!id) id = 'Desconhecido';

    const gpsList = header.gps;

    if (gpsList && gpsList.length > 0) {
      const lat = (gpsList[0].latitude || 0) / 360000;
      const lon = (gpsList[0].longitude || 0) / 360000;
      const vel = gpsList[0].velocidade || 0;
      const ignicaoStatus = header.sensores?.statusIgnicao || header.sensores?.status_ignicao;
      const ign = (ignicaoStatus === 'AVL_IO_LIGADO' || ignicaoStatus === 2);

      const currentVehicles = this.activeVehiclesSubject.getValue();
      let vehicleMap = new Map(currentVehicles.map(v => [v.id, v]));

      vehicleMap.set(String(id), {
        id: String(id),
        lat,
        lon,
        velocidade: vel,
        ignicao: ign,
        is_defasado: data.is_defasado,
        updatedAt: Date.now()
      });

      // Converte para array e ordena por mais recente (sem limite máximo para mostrar a frota toda)
      const sortedVehicles = Array.from(vehicleMap.values())
        .sort((a, b) => b.updatedAt - a.updatedAt);

      this.activeVehiclesSubject.next(sortedVehicles);
    }
  }
}
