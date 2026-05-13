// PeriziaDettaglio Component - Dettaglio singola perizia con foto, mappa, commenti
// Integra MapService per visualizzare la posizione della perizia sulla mappa
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Auth } from '../../services/auth';
import { Perizie } from '../../services/perizie';
import { MapService } from '../../services/map.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-perizia-dettaglio',
  imports: [Navbar, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './perizia-dettaglio.html',
  styleUrl: './perizia-dettaglio.css',
})
export class PeriziaDettaglio implements OnInit, OnDestroy {
  private authService: Auth = inject(Auth);
  private perizieService: Perizie = inject(Perizie);
  public mapService: MapService = inject(MapService);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);

  public perizia: any = null;
  public loading: boolean = true;
  public editDescrizione: boolean = false;
  public nuovaDescrizione: string = '';
  public editCommentoIndex: number = -1;
  public nuovoCommento: string = '';
  public isAdmin: boolean = false;

  ngOnInit() {
    if (!this.authService.username) {
      this.router.navigate(['login']);
      return;
    }
    this.isAdmin = this.authService.username === 'admin';
    const id = this.route.snapshot.params['id'];
    this.caricaPerizia(id);
  }

  ngOnDestroy() {
    this.mapService.destroyMap();
  }

  caricaPerizia(id: string) {
    this.loading = true;
    this.perizieService.getPerizia(id).subscribe({
      next: (data: any) => {
        this.perizia = data;
        this.nuovaDescrizione = data.descrizione || '';
        this.loading = false;
        // Inizializza mini-mappa
        if (this.perizia.coordinate && this.perizia.coordinate.lng && this.perizia.coordinate.lat) {
          setTimeout(() => this.inizializzaMappa(), 100);
        }
      },
      error: (err: any) => {
        this.loading = false;
        if (err.status === 403) {
          alert('Sessione scaduta');
          this.router.navigate(['login']);
        } else {
          alert('Errore: ' + err.error);
          this.router.navigate(['mappa']);
        }
      },
    });
  }

  async inizializzaMappa() {
    const center: [number, number] = [this.perizia.coordinate.lng, this.perizia.coordinate.lat];
    try {
      await this.mapService.drawMap(this.mapService.neutralStyle, 'detailMapContainer', center, 14);
      const popupHTML = `<b>${this.perizia.operatore}</b><br><small>${this.perizia.descrizione || ''}</small>`;
      this.mapService.addMarker(center, popupHTML);
    } catch (err) {
      console.error('Errore mappa dettaglio:', err);
    }
  }

  // Modifica descrizione (ADMIN)
  iniziaModificaDescrizione() {
    this.editDescrizione = true;
    this.nuovaDescrizione = this.perizia.descrizione || '';
  }

  salvaDescrizione() {
    this.perizieService.modificaPerizia(this.perizia._id, this.nuovaDescrizione).subscribe({
      next: () => {
        this.perizia.descrizione = this.nuovaDescrizione;
        this.editDescrizione = false;
      },
      error: (err: any) => {
        alert('Errore salvataggio: ' + err.error);
      },
    });
  }

  annullaModificaDescrizione() {
    this.editDescrizione = false;
  }

  // Modifica commento foto (ADMIN)
  iniziaModificaCommento(index: number) {
    this.editCommentoIndex = index;
    this.nuovoCommento = this.perizia.fotografie[index].commento || '';
  }

  salvaCommento(index: number) {
    this.perizieService
      .modificaCommentoFoto(this.perizia._id, index, this.nuovoCommento)
      .subscribe({
        next: () => {
          this.perizia.fotografie[index].commento = this.nuovoCommento;
          this.editCommentoIndex = -1;
        },
        error: (err: any) => {
          alert('Errore salvataggio commento: ' + err.error);
        },
      });
  }

  annullaModificaCommento() {
    this.editCommentoIndex = -1;
  }

  // Elimina perizia
  eliminaPerizia() {
    if (confirm('Sei sicuro di voler eliminare questa perizia?')) {
      this.perizieService.eliminaPerizia(this.perizia._id).subscribe({
        next: () => {
          alert('Perizia eliminata con successo');
          this.router.navigate(['mappa']);
        },
        error: (err: any) => {
          alert('Errore eliminazione: ' + err.error);
        },
      });
    }
  }

  tornaAllaLista() {
    this.router.navigate(['mappa']);
  }
}
