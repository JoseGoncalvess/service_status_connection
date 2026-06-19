import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionStatusComponent } from '../../shared/ui/connection-status.component';
import { ActiveTimerComponent } from '../../shared/ui/active-timer.component';
import { LatencyIndicatorComponent } from '../../shared/ui/latency-indicator.component';
import { TelemetryLogComponent } from '../../shared/ui/telemetry-log.component';
import { VehicleMapComponent } from '../../shared/ui/vehicle-map.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ConnectionStatusComponent, ActiveTimerComponent, LatencyIndicatorComponent, TelemetryLogComponent, VehicleMapComponent],
  template: `
    <div class="min-h-screen p-8 flex flex-col items-center justify-center relative overflow-hidden">
      <!-- Background sutil -->
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black z-0"></div>
      
      <div class="relative z-10 w-full max-w-6xl">
        <header class="mb-12 text-center">
          <h1 class="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
            AVL Monitor
          </h1>
          <p class="mt-3 text-gray-400 font-medium tracking-wide uppercase text-sm">Health Dashboard & Realtime Telemetry</p>
        </header>

        <!-- Bento Box Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <!-- Card 1: Semáforo -->
          <div class="glass-panel p-6 min-h-[250px] flex flex-col items-center justify-center transition-transform hover:scale-[1.02]">
            <app-connection-status></app-connection-status>
          </div>

          <!-- Card 2: Cronômetro -->
          <div class="glass-panel p-6 min-h-[250px] flex flex-col items-center justify-center md:col-span-2 transition-transform hover:scale-[1.01]">
            <app-active-timer></app-active-timer>
          </div>

          <!-- Card 3: Latência -->
          <div class="glass-panel p-6 min-h-[250px] flex flex-col items-center justify-center md:col-span-3 transition-transform hover:scale-[1.01]">
            <app-latency-indicator></app-latency-indicator>
          </div>

          <!-- Card 4: Mapa de Veículos -->
          <div class="glass-panel p-2 flex flex-col md:col-span-3 h-[450px] transition-transform">
            <app-vehicle-map></app-vehicle-map>
          </div>

          <!-- Card 5: Log de Telemetria -->
          <div class="glass-panel p-6 flex flex-col md:col-span-3 transition-transform">
            <app-telemetry-log></app-telemetry-log>
          </div>

        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {}
