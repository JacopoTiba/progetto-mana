import { inject, Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import axios from 'axios';
import { AjaxService } from './ajax.service';

@Injectable({
  providedIn: 'root',
})
export class MapService {
  API_KEY = 'AVXt2UV4vFU23b3AwPbF';
  private ajax: AjaxService = inject(AjaxService);

  neutralStyle = 'https://api.maptiler.com/maps/streets-v2/style.json?key=';
  cartographicStyle = 'https://api.maptiler.com/maps/streets/style.json?key=';
  darkStyle = 'https://api.maptiler.com/maps/darkmatter/style.json?key=';
  satelliteStyle = 'https://api.maptiler.com/maps/satellite/style.json?key=';
  topoStyle = 'https://api.maptiler.com/maps/topo/style.json?key=';
  hibridStyle = 'https://api.maptiler.com/maps/hybrid/style.json?key=';
  openMapsStyle = 'https://api.maptiler.com/maps/openstreetmap/style.json?key=';

  map: maplibregl.Map | null = null;
  /* Elenco dei metodi esposti :
    1a. async geocode(stringAddress)
    1b. async geocode(lng, lat)
    2.  async drawMap(style, mapContainer, center, zoom) 	
    3.  addPOILayer(style)   
    4.  addMarker (center, iconPath="", label="", popupHTML="") 
    5.  async drawSingleRoutes(fromAddress, toAddress, color='#3887be', 
                                                    profile='driving')
                        	
  dove 'center' è un vettore del tipo [lng,lat]												  
*/

  // Se c'è un solo parametro, questo DEVE essere stringAddress
  async geocode(lng: any, lat: any = null) {
    const geocodingURL = 'https://api.maptiler.com/geocoding';
    let url;
    if (!lat) {
      let stringAddress = lng;
      // encodeURIComponent(s) codifica gli spazi e tutti i caratteri speciali
      // nei rispettivi codici utf-8 in formato esadecimale
      url = geocodingURL + `/${encodeURIComponent(stringAddress)}.json?key=` + this.API_KEY;
    } else {
      url = geocodingURL + `/${lng},${lat}.json?key=` + this.API_KEY;
    }

    const httpResponse = await this.ajax.sendRequest('GET', url).catch(this.ajax.errore);

    if (!httpResponse || httpResponse.data.features.length == 0) {
      alert('valore non valido');
      return;
    }
    // gpsAddress è un json contenente i campi center (coord gps) e place_name
    // più una serie di altre informazioni minori
    let gpsAddress = httpResponse.data.features[0];
    return gpsAddress;
  }

  async drawMap(style: any, mapContainer: any, center: any, zoom: any) {
    // Se lo style è una url testuale
    if (typeof style == 'string') style = style + this.API_KEY;
    // se non è STRING significa che è uno stile custom e non serve la API_KEI
    if (!this.map) {
      const mapOptions = {
        style,
        container: mapContainer,
        center: center,
        zoom,
        dragPan: true,
      };
      this.map = new maplibregl.Map(mapOptions);
      // zoom buttons
      this.map.addControl(new maplibregl.NavigationControl());
      // scala metrica in basso a sinistra
      this.map.addControl(new maplibregl.ScaleControl());
      return new Promise((resolve, reject) => {
        this.map!.on('load', () => {
          // Visualizzazione completa del foglio di stile
          // console.log("Style : ", this.map.getStyle())
          this.#customizeColors(this.map);
          resolve(this.map);
        });
        this.map!.on('error', (err) => {
          reject(err);
        });
      });
    } else {
      this.map.flyTo({
        center: center,
        zoom,
        essential: true, // forza l'animazione di transizione
      });
      return this.map;
    }
  }

  #customizeColors(map: any) {
    // creao un vettore con i names di tutti i layers
    const layersNames = this.map!.getStyle().layers.map((item) => item.id);
    layersNames.sort();
    // console.log(layersNames) // vedo i nomi di tutti i layers

    // log completo di un singolo layer. Vedo quali property usa
    const layer = this.map!.getStyle().layers.find((item) => item.id == 'Highway road');
    // console.log(layer)
    if (layer)
      // Se il layer "Highway road" esiste nello stile corrente
      map.setPaintProperty('Highway road', 'line-color', '#f0f');
  }

  addPOILayer(style = this.openMapsStyle) {
    // Questi stili non 'vedono' "openmaptiles"
    let source = 'openmaptiles';
    if (style == this.neutralStyle || style == this.hibridStyle || style == this.satelliteStyle)
      source = 'maptiler_planet';
    this.map!.addLayer({
      id: 'my-poi',
      source,
      'source-layer': 'poi',
      type: 'symbol',
      layout: {
        'text-field': ['get', 'name:latin'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          10, // fino allo zoom 14 il text-size dei POI è 10
          18,
          20, // oltre lo zoom 18 il text-size dei POI diventa 20
          // tra 14 e 18 il text-size cresce proporzionalmente allo zoom
        ],
        //"icon-image": "marker-15"
      },
      paint: {
        'text-color': '#222',
        'text-halo-color': '#f9f', // halo=alone/ombra
        'text-halo-width': 0,
      },
    });
  }

  addMarker(position: any, iconPath = '', label = '', popupHTML = '') {
    const markerOptions: any = {
      draggable: true,
      anchor: 'center', // il centro dell'imagine coincide con le coordinate
    };

    if (iconPath) {
      const markerContainer: any = document.createElement('div');
      markerContainer.style.width = '28px';
      markerContainer.style.height = '28px';
      markerContainer.style.display = 'flex';
      markerContainer.style.flexDirection = 'column';
      markerContainer.style.alignItems = 'center'; // allineamento orizz
      markerContainer.style.justifyContent = 'flex-end'; // allineamento vert
      const img = document.createElement('img');
      img.src = iconPath;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.display = 'block';
      // cambia forma al puntatore, permette click/popup
      img.style.pointerEvents = 'auto';
      markerContainer.appendChild(img);

      // etichetta di testo
      if (label) {
        const span = document.createElement('span');
        span.textContent = label;
        span.style.display = 'block';
        span.style.fontSize = '9pt'; // default
        span.style.color = '#000'; // default
        span.style.fontWeight = 'bold';
        span.style.backgroundColor = 'transparent'; // 'white';
        span.style.whiteSpace = 'nowrap'; // Evita che il testo vada a capo
        span.style.position = 'absolute';
        span.style.top = '-16px'; // 16px verso l'alto
        span.style.left = '0px'; //  0px verso destra
        markerContainer.appendChild(span);
      }
      markerOptions['element'] = markerContainer;
    } else markerOptions['color'] = '#e74c3c';

    // Costruzione della popup con offset rispetto alla posiz di default
    const popup = new maplibregl.Popup({ offset: [6, -12] });
    if (popupHTML) popup.setHTML(popupHTML);
    else popup.setHTML('');

    // costruzione del marker
    let marker = new maplibregl.Marker(markerOptions);
    marker.setLngLat(position);
    marker.setPopup(popup);
    marker.addTo(this.map!);
    return marker;
  }

  updatePopup(marker: any, html: any) {
    marker.getPopup().setHTML(html);
  }
  destroyMap() {
    this.map!.remove();

  }
  async drawSingleRoute(fromAddress: any, toAddress: any, color = '#3887be', profile = 'driving') {
    const startAddress = await this.geocode(fromAddress);
    const endAddress = await this.geocode(toAddress);

    if (!startAddress || !endAddress) return;

    const startCoords = startAddress.center;
    const endCoords = endAddress.center;

    const routingURL = `https://router.project-osrm.org/route/v1/${profile}/${startCoords.join(',')};${endCoords.join(',')}?overview=full&geometries=geojson`;
    const response = await this.ajax.sendRequest('GET', routingURL).catch(this.ajax.errore);

    if (!response || !response.data.routes || response.data.routes.length === 0) {
      console.error('Nessun percorso trovato');
      alert('Nessun percorso trovato');
      return;
    }

    // il .coordinates finale è legato a overview=full e geometries=geojson
    const coordinates = response.data.routes[0].geometry.coordinates;
    const polyline: any = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
    };

    if (this.map!.getSource('route')) {
      (this.map!.getSource('route') as maplibregl.GeoJSONSource).setData(polyline);
    } else {
      console.log("creating a new dataSource 'route'");
      this.map!.addSource('route', {
        type: 'geojson',
        data: polyline,
      });

      // bordino nero
      this.map!.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route', // sorgente dati creata in precedenza
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#000',
          'line-width': 8,
          'line-opacity': 0.3,
        },
      });

      // percorso blu
      this.map!.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route', // sorgente dati creata in precedenza
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },

        paint: {
          'line-color': color,
          'line-width': 5,
          'line-opacity': 0.8,
        },
      });
    }
    this.#adjustZoom(response.data.routes[0].geometry.coordinates);
    return {
      duration: response.data.routes[0].duration,
      distance: response.data.routes[0].distance,
    };
  }

  #adjustZoom(coordinates: any) {
    // adattamento dello zoom per mostrare tutto il percorso
    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach((c: [number, number]) => bounds.extend(c));
    this.map!.fitBounds(bounds, {
      padding: 60,
      duration: 1000,
      maxZoom: 15,
    });
  }
}
