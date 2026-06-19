import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MqttMonitorService } from '../../core/services/mqtt-monitor.service';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

@Component({
  selector: 'app-telemetry-log',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full flex flex-col">
      <div class="sticky top-0 bg-gray-900/95 py-3 z-10 border-b border-gray-800 mb-2 flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <h2 class="text-gray-400 font-semibold uppercase tracking-wider text-sm">
            Registros (Log)
          </h2>
          <span class="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full font-mono border border-gray-700" title="Total de veículos rastreados atualmente">
            Total Rastreando: {{ activeVehiclesCount$ | async }}
          </span>
        </div>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <svg class="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Filtrar por prefixo..." 
            class="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white pl-8 pr-2 py-1.5 focus:outline-none focus:border-indigo-500 focus:bg-gray-700 transition-colors"
            (input)="onFilterChange($event)"
          >
        </div>
      </div>
      
      <div class="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-xs">
        <ng-container *ngIf="logs$ | async as logs">
          <div *ngIf="logs.length === 0" class="flex h-full items-center justify-center text-gray-500 italic">
            Nenhum pacote encontrado...
          </div>
          
          <div *ngFor="let log of logs; let i = index" 
               class="p-3 rounded-lg border flex flex-col gap-1 transition-all"
               [ngClass]="log.is_defasado ? 'bg-amber-950/20 border-amber-900/50' : 'bg-emerald-900/10 border-emerald-800/30'">
            
            <div class="flex justify-between items-center text-gray-400 mb-1">
              <span class="font-bold flex items-center gap-2" [ngClass]="log.is_defasado ? 'text-amber-500' : 'text-emerald-500'">
                <span class="w-2 h-2 rounded-full" [ngClass]="log.is_defasado ? 'bg-amber-500' : 'bg-emerald-500'"></span>
                Veículo: {{ getVehicleId(log.payload) }}
                <span *ngIf="getVehicleLine(log.payload)" class="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 whitespace-nowrap ml-1 font-mono">
                  L: {{ getVehicleLine(log.payload) }}
                </span>
              </span>
              <div class="flex items-center gap-3">
                <span>Latência: {{ log.payload._metadata?.latency_seconds | number:'1.0-3' }}s</span>
                <button (click)="exportJson(log.payload)" class="text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1" title="Exportar JSON completo do pacote">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  JSON
                </button>
              </div>
            </div>
            
            <div class="text-gray-300 grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
              <div><span class="text-gray-500">Lat:</span> {{ log.payload.avlHeader?.gps?.length ? (log.payload.avlHeader.gps[0].latitude / 360000 | number:'1.0-6') : 'N/A' }}</div>
              <div><span class="text-gray-500">Lon:</span> {{ log.payload.avlHeader?.gps?.length ? (log.payload.avlHeader.gps[0].longitude / 360000 | number:'1.0-6') : 'N/A' }}</div>
              <div><span class="text-gray-500">Velocidade:</span> {{ log.payload.avlHeader?.gps?.length ? log.payload.avlHeader.gps[0].velocidade : '0' }} km/h</div>
              <div><span class="text-gray-500">Ignição:</span> 
                <span [ngClass]="(log.payload.avlHeader?.sensores?.statusIgnicao === 'AVL_IO_LIGADO' || log.payload.avlHeader?.sensores?.status_ignicao === 2) ? 'text-green-400' : 'text-red-400'">
                  {{ (log.payload.avlHeader?.sensores?.statusIgnicao === 'AVL_IO_LIGADO' || log.payload.avlHeader?.sensores?.status_ignicao === 2) ? 'ON' : 'OFF' }}
                </span>
              </div>
            </div>
            
            <div class="text-gray-600 text-[10px] text-right mt-1">
              Recebido do BFF em: {{ log.payload._metadata?.server_received_at_ms | date:'HH:mm:ss.SSS' }}
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 400px;
      max-height: 500px;
    }
    
    /* Scrollbar minimalista */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background-color: #374151;
      border-radius: 10px;
    }
  `]
})
export class TelemetryLogComponent {
  private mqtt = inject(MqttMonitorService);
  
  filterSubject = new BehaviorSubject<string>('');
  
  logs$ = combineLatest([
    this.mqtt.logs$,
    this.filterSubject
  ]).pipe(
    map(([logs, filterText]) => {
      if (!filterText) return logs;
      return logs.filter(log => {
        const id = this.getVehicleId(log.payload);
        return String(id).toLowerCase().includes(filterText.toLowerCase().trim());
      });
    })
  );

  activeVehiclesCount$ = this.mqtt.activeVehicles$.pipe(map(v => v.length));

  onFilterChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.filterSubject.next(input.value);
  }

  getVehicleId(payload: any): string {
    const id = payload.avlHeader?.validador?.prefixoVeiculo || 
               payload.avlHeader?.validador?.prefixo_veiculo || 
               payload.avlHeader?.validador?.codVeiculo || 
               payload.avlHeader?.validador?.cod_veiculo || 
               payload.avlHeader?.modem?.imei || 
               'Desconhecido';
    return typeof id === 'string' ? id.trim() : String(id);
  }

  getVehicleLine(payload: any): string | null {
    const validador = payload?.avlHeader?.validador;
    if (!validador) return null;
    let linha = validador.prefixoLinha || validador.prefixo_linha;
    if (linha && typeof linha === 'string') {
      linha = linha.trim();
      return linha.length > 0 ? linha : null;
    }
    return null;
  }

  exportJson(payload: any) {
    if (!payload) return;
    
    const id = this.getVehicleId(payload);
    const timestamp = payload._metadata?.server_received_at_ms || Date.now();
    const fileName = 'pacote_veiculo_' + id + '_' + timestamp + '.json';
    
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
