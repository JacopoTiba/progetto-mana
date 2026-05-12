// MapService - Adattamento Angular di myMapLibre.js (lib/myMapLibre.js)
// Converte la classe MyMapLibre in un servizio Angular injectable
// Usa la libreria maplibre-gl installata via npm invece del file locale
import { Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';

@Injectable({
    providedIn: 'root',
})
export class MapService {

    API_KEY = "AVXt2UV4vFU23b3AwPbF";

    neutralStyle = "https://api.maptiler.com/maps/streets-v2/style.json?key=";
    cartographicStyle = "https://api.maptiler.com/maps/streets/style.json?key=";
    darkStyle = "https://api.maptiler.com/maps/darkmatter/style.json?key=";
    satelliteStyle = "https://api.maptiler.com/maps/satellite/style.json?key=";
    topoStyle = "https://api.maptiler.com/maps/topo/style.json?key=";
    hibridStyle = "https://api.maptiler.com/maps/hybrid/style.json?key=";
    openMapsStyle = "https://api.maptiler.com/maps/openstreetmap/style.json?key=";

    map: maplibregl.Map | null = null;

    // Geocoding: da indirizzo stringa a coordinate GPS o viceversa
    // Corrisponde a myMapLibre.geocode() di lib/myMapLibre.js
    async geocode(lng: any, lat?: number): Promise<any> {
        const geocodingURL = "https://api.maptiler.com/geocoding";
        let url: string;
        if (!lat) {
            let stringAddress = lng;
            url = geocodingURL + `/${encodeURIComponent(stringAddress)}.json?key=` + this.API_KEY;
        } else {
            url = geocodingURL + `/${lng},${lat}.json?key=` + this.API_KEY;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!data || !data.features || data.features.length === 0) {
            console.error("Indirizzo non trovato");
            return null;
        }

        return data.features[0];
    }

    // Disegna la mappa o sposta il centro se già esiste
    // Corrisponde a myMapLibre.drawMap() di lib/myMapLibre.js
    async drawMap(style: string, mapContainer: string | HTMLElement, center: [number, number], zoom: number): Promise<maplibregl.Map> {
        let mapStyle: any = style;
        if (typeof style === 'string') {
            mapStyle = style + this.API_KEY;
        }

        if (!this.map) {
            const mapOptions: maplibregl.MapOptions = {
                style: mapStyle,
                container: mapContainer,
                center: center,
                zoom: zoom,
                dragPan: true
            };

            this.map = new maplibregl.Map(mapOptions);
            this.map.addControl(new maplibregl.NavigationControl());
            this.map.addControl(new maplibregl.ScaleControl());

            return new Promise((resolve, reject) => {
                this.map!.on('load', () => {
                    resolve(this.map!);
                });
                this.map!.on('error', (err) => {
                    reject(err);
                });
            });
        } else {
            this.map.flyTo({
                center: center,
                zoom: zoom,
                essential: true
            });
            return this.map;
        }
    }

    // Aggiunge un marker sulla mappa
    // Corrisponde a myMapLibre.addMarker() di lib/myMapLibre.js
    addMarker(center: [number, number], popupHTML: string = "", color: string = "#e74c3c"): maplibregl.Marker {
        const markerOptions: maplibregl.MarkerOptions = {
            draggable: false,
            color: color,
        };

        const popup = new maplibregl.Popup({ offset: [6, -12] });
        if (popupHTML) {
            popup.setHTML(popupHTML);
        }

        let marker = new maplibregl.Marker(markerOptions);
        marker.setLngLat(center);
        marker.setPopup(popup);
        marker.addTo(this.map!);
        return marker;
    }

    // Distrugge la mappa corrente
    destroyMap() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    // Adatta lo zoom per mostrare tutti i marker
    fitBounds(coordinates: [number, number][]) {
        if (!this.map || coordinates.length === 0) return;
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach(c => bounds.extend(c));
        this.map.fitBounds(bounds, {
            padding: 60,
            duration: 1000,
            maxZoom: 15,
        });
    }
}
