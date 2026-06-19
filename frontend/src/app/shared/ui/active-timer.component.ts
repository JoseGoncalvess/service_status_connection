import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MqttMonitorService } from '../../core/services/mqtt-monitor.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-active-timer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2 class="text-gray-400 font-semibold mb-4 uppercase tracking-wider text-sm">Fila de Dados (Watchdog)</h2>
    
    <div class="flex-1 flex flex-col items-center justify-center w-full">
      <div class="text-6xl md:text-7xl font-light font-mono tabular-nums transition-colors duration-500"
           [ngClass]="isStalled ? 'text-red-500 animate-pulse' : 'text-gray-100'">
        {{ formattedTime }}
      </div>
      
      <div class="mt-4 flex items-center space-x-2">
        <span class="relative flex h-3 w-3">
          <span *ngIf="!isStalled" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3"
                [ngClass]="isStalled ? 'bg-red-500' : 'bg-blue-500'"></span>
        </span>
        <span class="text-sm font-medium tracking-wide" [ngClass]="isStalled ? 'text-red-400' : 'text-blue-400'">
          {{ isStalled ? 'FILA PARADA' : 'RECEBENDO DADOS' }}
        </span>
      </div>
    </div>
  `
})
export class ActiveTimerComponent implements OnInit, OnDestroy {
  private mqtt = inject(MqttMonitorService);
  
  isStalled = true;
  secondsSinceLastData = 0;
  formattedTime = '00:00';
  
  private sub = new Subscription();
  private timerSub: Subscription | null = null;

  ngOnInit() {
    this.sub.add(
      this.mqtt.watchdogAlert$.subscribe(stalled => {
        this.isStalled = stalled;
      })
    );

    this.sub.add(
      this.mqtt.telemetryData$.subscribe(data => {
        if (data) {
          // Reseta o contador ao receber dados
          this.secondsSinceLastData = 0;
          this.updateDisplay();
        }
      })
    );

    // Incrementa o contador visualmente a cada segundo
    this.timerSub = interval(1000).subscribe(() => {
      if (!this.isStalled) {
        this.secondsSinceLastData++;
        this.updateDisplay();
      }
    });
  }

  updateDisplay() {
    const mins = Math.floor(this.secondsSinceLastData / 60);
    const secs = this.secondsSinceLastData % 60;
    this.formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
  }
}
