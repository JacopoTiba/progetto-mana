import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Mappa } from './pages/mappa/mappa';
import { PeriziaDettaglio } from './pages/perizia-dettaglio/perizia-dettaglio';
import { GestioneUtenti } from './pages/gestione-utenti/gestione-utenti';

export const routes: Routes = [
    { path: "", redirectTo: "/login", pathMatch: "full" },
    { path: "login", component: Login },
    { path: "mappa", component: Mappa },
    { path: "perizia/:id", component: PeriziaDettaglio },
    { path: "gestione-utenti", component: GestioneUtenti }
];
