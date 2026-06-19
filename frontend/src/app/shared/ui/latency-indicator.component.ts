import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MqttMonitorService } from '../../core/services/mqtt-monitor.service';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-latency-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full flex flex-col md:flex-row items-center justify-between px-8">
      <div class="flex flex-col items-center md:items-start mb-6 md:mb-0">
        <h2 class="text-gray-400 font-semibold mb-2 uppercase tracking-wider text-sm">Latência do Pacote</h2>
        <p class="text-xs text-gray-500 max-w-xs text-center md:text-left">
          Diferença de tempo entre a geração do evento pelo equipamento (GPS) e a recepção no servidor BFF.
        </p>
      </div>

      <ng-container *ngIf="telemetryData$ | async as data; else waiting">
        <div class="flex items-center space-x-4 w-full justify-end">
          
          <!-- Sparkline Gráfico SVG -->
          <div class="h-12 w-24 opacity-80 hidden md:block" *ngIf="latencyHistory$ | async as history">
            <svg viewBox="0 0 100 40" class="w-full h-full overflow-visible" preserveAspectRatio="none">
              <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.1)" stroke-width="0.5" stroke-dasharray="2,2" />
              <polyline 
                [attr.points]="getSparklinePoints(history)" 
                fill="none" 
                [attr.stroke]="data.is_defasado ? '#f59e0b' : '#34d399'" 
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle *ngIf="history.length > 0" [attr.cx]="100" [attr.cy]="getLastY(history)" r="2.5" [attr.fill]="data.is_defasado ? '#f59e0b' : '#34d399'" class="animate-ping origin-center" />
              <circle *ngIf="history.length > 0" [attr.cx]="100" [attr.cy]="getLastY(history)" r="2" [attr.fill]="data.is_defasado ? '#f59e0b' : '#34d399'" />
            </svg>
          </div>

          <!-- Última Recepção -->
          <div class="flex flex-col items-end border-r border-gray-800/50 pr-4 hidden sm:flex">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Última Comunicação</div>
            <div class="text-base font-mono text-gray-300 tracking-tight">
              {{ data.payload._metadata?.server_received_at_ms | date:'dd/MM/yyyy HH:mm:ss' }}
            </div>
          </div>

          <!-- Indicador Numérico de Latência (Largura fixa para não empurrar elementos) -->
          <div class="flex flex-col items-end min-w-[150px]">
            <div class="text-4xl md:text-5xl font-bold tracking-tighter tabular-nums"
                 [ngClass]="data.is_defasado ? 'text-amber-500' : 'text-emerald-400'">
              {{ formatLatency(data.payload._metadata?.latency_seconds) }}
            </div>
            <div class="text-[11px] font-medium mt-1 uppercase tracking-wide flex items-center justify-end gap-1.5 w-full"
                 [ngClass]="data.is_defasado ? 'text-amber-500' : 'text-emerald-500'">
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" [ngClass]="data.is_defasado ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              <span>{{ data.is_defasado ? 'DADOS DEFASADOS' : 'TEMPO REAL' }}</span>
            </div>
          </div>
          
        </div>
      </ng-container>

      <ng-template #waiting>
        <div class="flex flex-col items-center justify-center opacity-50">
          <svg class="w-10 h-10 text-gray-600 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-sm font-medium text-gray-500 uppercase tracking-widest">Aguardando...</span>
        </div>
      </ng-template>
    </div>
  `
})
export class LatencyIndicatorComponent {
  private mqtt = inject(MqttMonitorService);
  telemetryData$ = this.mqtt.telemetryData$;
  latencyHistory$ = this.mqtt.latencyHistory$;

  getSparklinePoints(history: number[]): string {
    if (!history || history.length === 0) return '';
    
    // Define a largura total como 100 e a altura como 40
    const width = 100;
    const height = 40;
    const maxVal = Math.max(...history, 15); // Pelo menos 15 para ter escala
    
    const points = history.map((val, index) => {
      const x = (index / (Math.max(history.length - 1, 1))) * width;
      // Inverte o Y porque SVG cresce pra baixo
      const y = height - (Math.min(val, maxVal) / maxVal) * height;
      return `${x},${y}`;
    });
    
    return points.join(' ');
  }

  getLastY(history: number[]): number {
    if (!history || history.length === 0) return 40;
    const height = 40;
    const maxVal = Math.max(...history, 15);
    const lastVal = history[history.length - 1];
    return height - (Math.min(lastVal, maxVal) / maxVal) * height;
  }

  formatLatency(seconds: number | undefined | null): string {
    if (seconds === undefined || seconds === null) return '--';
    
    if (seconds < 60) {
      return seconds.toFixed(1) + 's';
    }
    
    const minutes = Math.floor(seconds / 60);
    const remSeconds = Math.floor(seconds % 60);
    
    if (minutes < 60) {
      return minutes + 'm ' + remSeconds + 's';
    }
    
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return hours + 'h ' + remMinutes + 'm';
  }
}
