// Perizie Service - Gestione CRUD perizie
// Interagisce con le API del server per perizie, foto e utenti
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DataStorageService } from './data-storage.service';

@Injectable({
    providedIn: 'root',
})
export class Perizie {
    private dataStorageService: DataStorageService = inject(DataStorageService);

    // Elenco perizie (tutte o filtrate per operatore)
    getPerizie(operatore?: string): Observable<any> {
        let params: any = {};
        if (operatore) {
            params.operatore = operatore;
        }
        return this.dataStorageService.InviaRichiesta("GET", "/perizie", params)!;
    }

    // Dettaglio singola perizia
    getPerizia(id: string): Observable<any> {
        return this.dataStorageService.InviaRichiesta("GET", "/perizie/" + id)!;
    }

    // Creazione nuova perizia
    creaPerizia(perizia: any): Observable<any> {
        return this.dataStorageService.InviaRichiesta("POST", "/perizie", perizia)!;
    }

    // Upload foto per una perizia (base64 + commento)
    uploadFoto(periziaId: string, imgBase64: string, commento: string): Observable<any> {
        return this.dataStorageService.InviaRichiesta("POST", "/perizie/" + periziaId + "/foto", {
            img: imgBase64,
            commento: commento
        })!;
    }

    // Modifica descrizione perizia (PATCH)
    modificaPerizia(periziaId: string, descrizione: string): Observable<any> {
        return this.dataStorageService.InviaRichiesta("PATCH", "/perizie/" + periziaId, {
            descrizione: descrizione
        })!;
    }

    // Modifica commento foto (PATCH)
    modificaCommentoFoto(periziaId: string, fotoIndex: number, commento: string): Observable<any> {
        return this.dataStorageService.InviaRichiesta("PATCH", "/perizie/" + periziaId + "/foto/" + fotoIndex, {
            commento: commento
        })!;
    }

    // Elimina perizia
    eliminaPerizia(periziaId: string): Observable<any> {
        return this.dataStorageService.InviaRichiesta("DELETE", "/perizie/" + periziaId)!;
    }

    // Elenco utenti (solo ADMIN)
    getUtenti(): Observable<any> {
        return this.dataStorageService.InviaRichiesta("GET", "/utenti")!;
    }

    // Creazione nuovo utente (solo ADMIN)
    creaUtente(username: string, info: any): Observable<any> {
        return this.dataStorageService.InviaRichiesta("POST", "/creaUtente", {
            username: username,
            info: info
        })!;
    }
}
