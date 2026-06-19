import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MqttMonitorService, VehicleState } from '../../core/services/mqtt-monitor.service';
import { Subscription, interval } from 'rxjs';
import * as L from 'leaflet';

// Corrige problema de caminhos de ícones no Leaflet em projetos Angular
const iconRetinaUrl = 'assets/marker-icon-2x.png';
const iconUrl = 'assets/marker-icon.png';
const shadowUrl = 'assets/marker-shadow.png';
const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-vehicle-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full min-h-[400px] flex flex-col relative rounded-xl overflow-hidden border border-gray-800">
      <div class="absolute top-4 right-4 z-[400] flex flex-col gap-2 items-end">
        <div class="bg-gray-900/80 backdrop-blur border border-gray-700 p-3 rounded-lg shadow-xl text-xs font-mono text-center w-full">
          <div class="text-gray-400 mb-1 uppercase tracking-wider font-semibold">Veículos no Mapa</div>
          <div class="text-2xl font-bold text-emerald-400">{{ activeCount }}</div>
        </div>
        <div class="bg-gray-900/80 backdrop-blur border border-gray-700 p-2 rounded-lg shadow-xl text-xs font-mono text-center w-full">
          <div class="text-gray-400 mb-1 tracking-wider font-semibold">Último Pacote</div>
          <div class="text-sm font-bold text-blue-400">{{ lastUpdateText }}</div>
        </div>
        <div class="bg-gray-900/80 backdrop-blur border border-gray-700 p-2 px-3 rounded-lg shadow-xl text-xs flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition-colors mt-1" (click)="toggleIgnitionFilter()">
          <input type="checkbox" [checked]="showOnlyIgnitionOn" class="w-3.5 h-3.5 accent-emerald-500 cursor-pointer pointer-events-none rounded">
          <span class="text-gray-300 font-medium select-none tracking-wide">Apenas Ignição ON</span>
        </div>
      </div>
      <div #mapContainer class="w-full h-full flex-1 z-0 bg-gray-900"></div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class VehicleMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  
  private mqtt = inject(MqttMonitorService);
  private sub?: Subscription;
  
  private map!: L.Map;
  private markers: Map<string, L.Marker> = new Map();
  public activeCount = 0;
  public lastUpdateText = 'Aguardando...';
  private globalLastUpdateMs = 0;
  private timeSub?: Subscription;

  public showOnlyIgnitionOn = false;
  private currentVehicles: VehicleState[] = [];

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.initMap();
    
    this.sub = this.mqtt.activeVehicles$.subscribe(vehicles => {
      this.currentVehicles = vehicles;
      this.renderMap();
    });

    this.timeSub = interval(1000).subscribe(() => {
      if (this.globalLastUpdateMs > 0) {
        const diffSecs = Math.floor((Date.now() - this.globalLastUpdateMs) / 1000);
        this.lastUpdateText = 'Há ' + diffSecs + 's';
      }
    });
  }

  toggleIgnitionFilter() {
    this.showOnlyIgnitionOn = !this.showOnlyIgnitionOn;
    this.renderMap();
  }

  private renderMap() {
    let vehiclesToRender = this.currentVehicles;
    if (this.showOnlyIgnitionOn) {
      vehiclesToRender = vehiclesToRender.filter(v => v.ignicao);
    }
    this.updateMap(vehiclesToRender);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.timeSub?.unsubscribe();
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap() {
    // Inicializa o mapa focado de forma central no Brasil
    this.map = L.map(this.mapContainer.nativeElement).setView([-15.7801, -47.9292], 4);

    // Adiciona o tile layer Dark Matter do CartoDB (elegante e combina com o painel)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.map);
  }

  private updateMap(vehicles: VehicleState[]) {
    this.activeCount = vehicles.length;
    if (vehicles.length > 0) {
      this.globalLastUpdateMs = Math.max(...vehicles.map(v => v.updatedAt));
    }
    
    const currentIds = new Set(vehicles.map(v => v.id));

    // Remove marcadores de veículos que não estão mais na lista ativa
    for (const [id, marker] of this.markers.entries()) {
      if (!currentIds.has(id)) {
        this.map.removeLayer(marker);
        this.markers.delete(id);
      }
    }

    // Adiciona ou atualiza marcadores
    let bounds = L.latLngBounds([]);
    
    for (const v of vehicles) {
      if (v.lat === 0 && v.lon === 0) continue; // Pula coordenadas inválidas

      const latLng = L.latLng(v.lat, v.lon);
      bounds.extend(latLng);

      const isRecent = (Date.now() - v.updatedAt) < 10000; // Atualizado há menos de 10s
      const isParked = v.velocidade === 0;
      
      let pingClass = '';
      if (isRecent) {
        pingClass = '<span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ' + (isParked ? 'bg-amber-400' : 'bg-emerald-400') + '"></span>';
      }

      const iconHtml = 
        '<div class="relative flex h-4 w-4">' +
          pingClass +
          '<span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white ' + (isParked ? 'bg-amber-500' : 'bg-emerald-500') + '"></span>' +
        '</div>';

      const customIcon = L.divIcon({
        html: iconHtml,
        className: '', // Remove the default Leaflet icon background
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const popupContent = 
        '<div class="font-sans text-sm">' +
          '<div class="font-bold text-gray-800 border-b pb-1 mb-1">🚗 Prefixo: ' + v.id + '</div>' +
          '<div class="text-gray-600">Velocidade: <span class="font-mono font-bold ' + (isParked ? 'text-amber-600' : 'text-emerald-600') + '">' + v.velocidade + ' km/h</span></div>' +
          '<div class="text-gray-600">Ignição: ' + (v.ignicao ? '<span class="text-green-600 font-bold">ON</span>' : '<span class="text-red-600 font-bold">OFF</span>') + '</div>' +
          '<div class="text-xs text-gray-400 mt-2">' + new Date(v.updatedAt).toLocaleTimeString() + '</div>' +
        '</div>';

      if (this.markers.has(v.id)) {
        // Atualiza
        const marker = this.markers.get(v.id)!;
        marker.setLatLng(latLng);
        marker.setIcon(customIcon);
        marker.getPopup()?.setContent(popupContent);
        
      } else {
        // Cria novo
        const marker = L.marker(latLng, { icon: customIcon });
        marker.bindPopup(popupContent);
        marker.addTo(this.map);
        this.markers.set(v.id, marker);
      }
    }

    // Opcional: Ajustar zoom para caber todos se for a primeira carga ou se quisermos auto-fit
    // Como os dados chegam sempre, auto-fit constante pode ser irritante. Vamos fazer auto-fit apenas se houver menos de 5 veículos novos.
  }
}
