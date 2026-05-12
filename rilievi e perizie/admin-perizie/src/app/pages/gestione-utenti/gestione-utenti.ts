// GestioneUtenti Component - Gestione utenti (solo ADMIN)
// Permette di visualizzare l'elenco utenti e crearne di nuovi
import { Component, inject, OnInit } from '@angular/core';
import { Auth } from '../../services/auth';
import { Perizie } from '../../services/perizie';
import { Router } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-gestione-utenti',
    imports: [Navbar, FormsModule],
    templateUrl: './gestione-utenti.html',
    styleUrl: './gestione-utenti.css',
})
export class GestioneUtenti implements OnInit {
    public authService: Auth = inject(Auth);
    private perizieService: Perizie = inject(Perizie);
    private router: Router = inject(Router);

    public utenti: any[] = [];
    public loading: boolean = false;
    public mostraForm: boolean = false;

    // Campi per nuovo utente
    public nuovoUsername: string = "";
    public nuovoNome: string = "";
    public nuovoCognome: string = "";
    public creando: boolean = false;

    ngOnInit() {
        if (!this.authService.username) {
            this.router.navigate(["login"]);
            return;
        }
        if (this.authService.username !== "admin") {
            alert("Solo l'utente ADMIN può accedere a questa sezione");
            this.router.navigate(["mappa"]);
            return;
        }
        this.caricaUtenti();
    }

    caricaUtenti() {
        this.loading = true;
        this.perizieService.getUtenti().subscribe({
            next: (data: any) => {
                this.utenti = data;
                this.loading = false;
            },
            error: (err: any) => {
                this.loading = false;
                if (err.status === 403) {
                    alert("Accesso non autorizzato o sessione scaduta");
                    this.router.navigate(["login"]);
                } else {
                    alert("Errore: " + err.error);
                }
            }
        });
    }

    toggleForm() {
        this.mostraForm = !this.mostraForm;
        if (!this.mostraForm) {
            this.resetForm();
        }
    }

    resetForm() {
        this.nuovoUsername = "";
        this.nuovoNome = "";
        this.nuovoCognome = "";
    }

    creaUtente() {
        if (!this.nuovoUsername) {
            alert("Inserisci un username (email)");
            return;
        }

        this.creando = true;
        const info = {
            nome: this.nuovoNome,
            cognome: this.nuovoCognome
        };

        this.perizieService.creaUtente(this.nuovoUsername, info).subscribe({
            next: (data: any) => {
                alert(data.message);
                this.creando = false;
                this.mostraForm = false;
                this.resetForm();
                this.caricaUtenti();
            },
            error: (err: any) => {
                this.creando = false;
                if (err.status === 409) {
                    alert("Username già esistente");
                } else {
                    alert("Errore: " + err.error);
                }
            }
        });
    }
}
