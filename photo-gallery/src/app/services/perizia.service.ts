import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { from, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PeriziaService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private SERVER = environment.serverUrl;

  private getOptions() {
    return {
      withCredentials: true,
      headers: {
        Authorization: 'Bearer ' + this.authService.token,
      },
    };
  }

  // 1. Crea la perizia principale (descrizione, coordinate, data automatici)
  creaPerizia(descrizione: string, lat: number, lng: number) {
    return from(
      CapacitorHttp.post({
        url: this.SERVER + '/perizie',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + this.authService.token,
        },
        data: { descrizione, lat, lng },
      }),
    ).pipe(
      map((response) => {
        if (response.status >= 400) {
          throw { status: response.status, error: response.data };
        }
        return response.data;
      }),
    );
  }

  // 2. Upload di una singola foto (base64 + commento) a una perizia esistente
  uploadFoto(periziaId: string, imgBase64: string, commento: string) {
    return from(
      CapacitorHttp.post({
        url: this.SERVER + '/perizie/' + periziaId + '/foto',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + this.authService.token,
        },
        data: { img: imgBase64, commento },
      }),
    ).pipe(
      map((response) => {
        if (response.status >= 400) {
          throw { status: response.status, error: response.data };
        }
        return response.data;
      }),
    );
  }
}
