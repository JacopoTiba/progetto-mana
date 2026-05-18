// Mappa Component - Visualizzazione mappa con marker delle perizie
// Integra MapService (adattamento Angular di myMapLibre.js)
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Auth } from '../../services/auth';
import { Perizie } from '../../services/perizie';
import { MapService } from '../../services/map.service';
import { Router } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-mappa',
  imports: [Navbar, FormsModule, DatePipe],
  templateUrl: './mappa.html',
  styleUrl: './mappa.css',
})
export class Mappa implements OnInit, OnDestroy {
  public authService: Auth = inject(Auth);
  private perizieService: Perizie = inject(Perizie);
  public mapService: MapService = inject(MapService);
  private router: Router = inject(Router);

  public perizieList: any[] = [];
  public filtroOperatore: string = '';
  public loading: boolean = false;

  ngOnInit() {
    if (!this.authService.username) {
      this.router.navigate(['login']);
      return;
    }
    this.caricaPerizie();
  }

  ngOnDestroy() {
    if (this.mapService.map != null) {
      this.mapService.map = null;
    }
  }
  caricaPerizie() {
    this.loading = true;
    const filtro = this.filtroOperatore || undefined;
    this.perizieService.getPerizie(filtro).subscribe({
      next: (data: any) => {
        this.perizieList = data;
        this.loading = false;
        // Inizializza la mappa dopo aver caricato le perizie
        setTimeout(() => this.inizializzaMappa(), 100);
      },
      error: (err: any) => {
        this.loading = false;
        if (err.status === 403) {
          alert('Sessione scaduta, ripeti il login');
          this.router.navigate(['login']);
        } else {
          alert('Errore nel caricamento delle perizie: ' + err.error);
        }
      },
    });
  }

  async inizializzaMappa() {
    const style = this.mapService.neutralStyle;
    const initialZoom = 12;

    try {
      // Otteniamo le coordinate della sede tramite geocode
      const officePos = await this.mapService.geocode(this.mapService.OFFICE_ADDRESS);
      const defaultCenter: [number, number] = officePos.center;

      await this.mapService.drawMap(style, 'mapContainer', defaultCenter, initialZoom);

      // Aggiungi marker per ogni perizia
      const coordinates: [number, number][] = [];
      for (const perizia of this.perizieList) {
        if (perizia.coordinate && perizia.coordinate.lng && perizia.coordinate.lat) {
          const center: [number, number] = [perizia.coordinate.lng, perizia.coordinate.lat];
          coordinates.push(center);

          const popupHTML = `
                        <div>
                            <strong>${perizia.operatore}</strong><br>
                            <small>${new Date(perizia.dataOra).toLocaleDateString('it-IT')}</small><br>
                            <p style="margin:4px 0">${perizia.descrizione ? perizia.descrizione.substring(0, 50) : 'Senza descrizione'}...</p>
                            <small>${perizia.fotografie ? perizia.fotografie.length : 0} foto</small>
                        </div>
                    `;
          const marker = this.mapService.addMarker(center, '', '', popupHTML);

          // Click sul marker -> dettaglio perizia
          marker.getElement().addEventListener('click', () => {
            this.router.navigate(['perizia', perizia._id]);
          });
        }
      }
    } catch (err) {
      console.error('Errore inizializzazione mappa:', err);
    }
  }

  filtra() {
    this.mapService.destroyMap();
    this.caricaPerizie();
  }

  resetFiltro() {
    this.filtroOperatore = '';
    this.filtra();
  }

  vaiDettaglio(periziaId: string) {
    this.router.navigate(['perizia', periziaId]);
  }
}
