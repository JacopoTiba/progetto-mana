import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonTextarea,
  IonButton,
  IonText,
  IonSpinner,
  IonProgressBar,
  IonBadge,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudUpload, checkmarkCircle, alertCircle } from 'ionicons/icons';
import { PhotoService } from '../services/photo.service';
import { PeriziaService } from '../services/perizia.service';
import { AuthService } from '../services/auth.service';
import { Geolocation } from '@capacitor/geolocation';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonTextarea,
    IonButton,
    IonText,
    IonSpinner,
    IonProgressBar,
    IonBadge,
    IonIcon,
  ],
})
export class Tab3Page {
  private photoService = inject(PhotoService);
  private periziaService = inject(PeriziaService);
  private authService = inject(AuthService);

  descrizione = '';
  loading = false;
  stato: 'idle' | 'successo' | 'errore' = 'idle';
  messaggioStato = '';
  progressoFoto = 0;
  totaleFoto = 0;

  constructor() {
    addIcons({ cloudUpload, checkmarkCircle, alertCircle });
  }

  get fotografie() {
    return this.photoService.photos;
  }

  get isLoggedIn() {
    return !!this.authService.username;
  }

  async uploadPerizia() {
    if (!this.isLoggedIn) {
      this.messaggioStato =
        'Devi effettuare il login prima di inviare una perizia.';
      this.stato = 'errore';
      return;
    }

    if (!this.descrizione.trim()) {
      this.messaggioStato = 'Inserisci una descrizione per la perizia.';
      this.stato = 'errore';
      return;
    }

    this.loading = true;
    this.stato = 'idle';
    this.progressoFoto = 0;

    try {
      // 1. Leggi le coordinate GPS automaticamente
      let lat = 0,
        lng = 0;
      try {
        const pos = await Geolocation.getCurrentPosition({ timeout: 5000 });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (gpsErr) {
        console.warn('GPS non disponibile, uso coordinate 0,0');
      }

      // 2. Crea la perizia
      const risposta: any = await this.periziaService
        .creaPerizia(this.descrizione, lat, lng)
        .toPromise();
      const periziaId = risposta.insertedId;

      // 3. Carica le foto una alla volta (se ci sono)
      this.totaleFoto = this.fotografie.length;
      for (let i = 0; i < this.fotografie.length; i++) {
        const foto = this.fotografie[i];
        const base64 = await this.fotoToBase64(foto.webviewPath!);
        await this.periziaService
          .uploadFoto(periziaId, base64, foto.commento || '')
          .toPromise();
        this.progressoFoto = i + 1;
      }

      // 4. Pulizia
      await this.photoService.svuotaGalleria();
      this.descrizione = '';
      this.stato = 'successo';
      this.messaggioStato = `Perizia inviata con successo!${this.totaleFoto > 0 ? ' (' + this.totaleFoto + ' foto)' : ''}`;
    } catch (err: any) {
      this.stato = 'errore';
      if (err.status === 403) {
        this.messaggioStato =
          'Sessione scaduta. Torna al Login e riautenticati.';
      } else {
        this.messaggioStato =
          "Errore durante l'invio: " +
          (err.error || err.message || 'Errore sconosciuto');
      }
    } finally {
      this.loading = false;
    }
  }

  // Converte un webviewPath (URL o data:) in stringa base64
  private async fotoToBase64(webviewPath: string): Promise<string> {
    const response = await fetch(webviewPath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  get progressoPercentuale(): number {
    if (this.totaleFoto === 0) return 0;
    return this.progressoFoto / this.totaleFoto;
  }
}
