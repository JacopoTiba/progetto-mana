import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DataStorageService } from './data-storage-service';

@Injectable({
    providedIn: 'root',
})
export class CommonService {
    private dataStorageService: DataStorageService = inject(DataStorageService);

    public selectedRoom: string = "";
    public username: string = "";
    public messages: any[] = [];
    public roomUsers: string[] = [];

    doLogin(user: any): Observable<any> {
        // facciamo chiamata POST in modo che i parametri non vengano accodati alla url rendendo il tutto più sicuro
        return this.dataStorageService.InviaRichiesta("POST", "/login", user)!
            .pipe(tap((data: any) => {  // dobbiamo usare le arrow function poichè con le function normali ridefiniscono il this
                this.username = data.username.split("@")[0];
            })); // pipe() consente di intercettare i dati pirma di restituirli al chiamante mentre invece tap() li legge 
    }

    doLogout(): Observable<any> {
        // facciamo chiamata POST in modo che i parametri non vengano accodati alla url rendendo il tutto più sicuro
        return this.dataStorageService.InviaRichiesta("POST", "/logout")!
    }

    loginWithGoogle(googleToken: string): Observable<any> {
        return this.dataStorageService.InviaRichiesta("POST", "/loginWithGoogle", { googleToken })!
            .pipe(tap((data: any) => {
                this.username = data.username.split("@")[0];
            }));
    }
}


