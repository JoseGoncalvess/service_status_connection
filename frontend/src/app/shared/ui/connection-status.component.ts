import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MqttMonitorService } from '../../core/services/mqtt-monitor.service';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2 class="text-gray-400 font-semibold mb-6 uppercase tracking-wider text-sm">Status do Broker</h2>
    
    <div class="relative flex items-center justify-center w-32 h-32 rounded-full"
         [ngClass]="(brokerStatus$ | async) ? 'glow-green bg-green-500/10' : 'glow-red bg-red-500/10'">
      
      <!-- Anel de Pulse -->
      <div *ngIf="brokerStatus$ | async" class="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-20"></div>
      
      <!-- Core (Luz) -->
      <div class="relative w-16 h-16 rounded-full flex items-center justify-center shadow-inner transition-colors duration-500"
           [ngClass]="(brokerStatus$ | async) ? 'bg-green-500' : 'bg-red-500'">
        
        <svg *ngIf="brokerStatus$ | async" class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>

        <svg *ngIf="!(brokerStatus$ | async)" class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>

      </div>
    </div>

    <p class="mt-6 text-lg font-medium transition-colors duration-500"
       [ngClass]="(brokerStatus$ | async) ? 'text-green-400' : 'text-red-400'">
      {{ (brokerStatus$ | async) ? 'ONLINE' : 'OFFLINE' }}
    </p>
  `
})
export class ConnectionStatusComponent {
  private mqtt = inject(MqttMonitorService);
  brokerStatus$ = this.mqtt.brokerStatus$;
}
