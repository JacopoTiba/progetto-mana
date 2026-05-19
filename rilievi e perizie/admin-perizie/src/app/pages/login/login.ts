import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
declare const google: any;

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    templateUrl: './login.html',
    styleUrl: './login.css',
})
export class Login {
    private authService: Auth = inject(Auth);
    private router: Router = inject(Router);

    txtUsername: string = "";
    txtPassword: string = "";
    lblErrore: boolean = false;
    lblErroreGoogle: string = "";

    controllaLogin(loginForm: NgForm) {
        this.chiudi();
        if (loginForm.invalid) {
            Object.values(loginForm.controls).forEach((control: any) => {
                control.markAsTouched();
            });
            return;
        }
        const user: any = {
            "username": this.txtUsername,
            "password": this.txtPassword
        };
        this.authService.doLogin(user).subscribe({
            "next": (data: any) => {
                this.router.navigate(["mappa"]);
            },
            "error": (error: any) => {
                console.log(error);
                if (error.status == 401)
                    this.lblErrore = true;
                else
                    alert(error.status + " : " + error.error);
            }
        });
    }

    chiudi() {
        this.lblErrore = false;
        this.lblErroreGoogle = "";
    }

    // LOGIN with Google
    ngAfterViewInit() {
        const checkGoogle = setInterval(() => {
            if (typeof google != 'undefined') {
                clearInterval(checkGoogle);
                this.initGoogle();
            }
        }, 100);
    }

    initGoogle() {
        let buttonContainer = document.getElementById("myGoogleDiv");
        buttonContainer!.innerHTML = "";
        google.accounts.id.initialize({
            client_id: environment.googleClientId,
            callback: (response: any) => this.loginWithGoogle(response),
        });
        google.accounts.id.renderButton(
            buttonContainer,
            {
                "theme": "outline",
                "size": "large",
                "type": "standard",
                "text": "continue_with",
                "shape": "rectangular",
                "logo_alignment": "center",
            }
        );
    }

    loginWithGoogle(response: any) {
        this.chiudi();
        let googleToken = response.credential;
        this.authService.loginWithGoogle(googleToken).subscribe({
            "next": (data: any) => {
                this.router.navigate(["mappa"]);
            },
            "error": (error: any) => {
                if (error.status == 403) {
                    this.lblErroreGoogle = "Questo account Google non è abilitato. Contatta l'amministratore.";
                    // Mostro l'errore sia come testo che come alert per sicurezza
                    alert("Accesso Negato: " + this.lblErroreGoogle);
                } else {
                    console.log(error);
                    alert(error.status + " : " + (typeof error.error === 'string' ? error.error : 'Errore sconosciuto'));
                }
            }
        });
    }
}
