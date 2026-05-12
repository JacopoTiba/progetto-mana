// Auth Service - Gestione autenticazione (login, logout, loginWithGoogle)
// Segue lo schema di common-service.ts di Ese10_ClientAngular
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DataStorageService } from './data-storage.service';

@Injectable({
    providedIn: 'root',
})
export class Auth {
    private dataStorageService: DataStorageService = inject(DataStorageService);

    public username: string = "";

    doLogin(user: any): Observable<any> {
        return this.dataStorageService.InviaRichiesta("POST", "/login", user)!
            .pipe(tap((data: any) => {
                this.username = data.username;
            }));
    }

    doLogout(): Observable<any> {
        return this.dataStorageService.InviaRichiesta("POST", "/logout")!;
    }

    loginWithGoogle(googleToken: string): Observable<any> {
        return this.dataStorageService.InviaRichiesta("POST", "/loginWithGoogle", { googleToken })!
            .pipe(tap((data: any) => {
                this.username = data.username;
            }));
    }
}
