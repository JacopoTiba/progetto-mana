import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonService } from '../services/common-service';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment.development';
declare const google: any;

@Component({
    selector: 'app-login-component',
    imports: [FormsModule],
    templateUrl: './login-component.html',
    styleUrl: './login-component.css',
})
export class LoginComponent {
    private commonService: CommonService = inject(CommonService);
    private router: Router = inject(Router); // componente che gestisce le route definite in app.routex.ts

    txtUsername: string = "pippo@gmail.com";
    txtPassword: string = "pippo";
    lblErrore: boolean = false;

    controllaLogin(loginForm: NgForm) {
        if (loginForm.invalid) {
            // me li impone a touched poichè la visualizzazione dell'errore è gestita solo se il componente è touched
            Object.values(loginForm.controls).forEach((control: any) => {
                control.markAsTouched();
            });
            return;
        }
        const user: any = {
            "username": this.txtUsername,
            "password": this.txtPassword
        };
        this.commonService.doLogin(user).subscribe({
            "next": (data: any) => {
                // navigate richiede un vettore con ogni elemento per route
                // vai al path /main dove carica mainComponent
                this.router.navigate(["header"]);
            },
            "error": (error: any) => {
                console.log(error);
                if (error.status == 401) // non autenticato username/password non valido
                    this.lblErrore = true;
                else
                    alert(error.status + " : " + error.error);
            }
        })
    }

    chiudi() {
        this.lblErrore = false;
    }

    // LOGIN with Google

    ngAfterViewInit() {
        const checkGoogle = setInterval(() => {
            if (typeof google != 'undefined') {
                clearInterval(checkGoogle);
                this.initGoogle()
            }
        }, 100);
    }

    initGoogle() { // immutata
        let buttonContainer = document.getElementById("myGoogleDiv")
        buttonContainer!.innerHTML = ""
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
        console.log(response.credential);
        let googleToken = response.credential;
        this.commonService.loginWithGoogle(googleToken).subscribe({
            "next": (data: any) => {
                this.router.navigate(["header"]);
            },
            "error": (error: any) => {
                if (error.status == 403)
                    this.lblErrore = true;
                else {
                    console.log(error);
                    alert(error.status + " : " + error.error);
                }
            }
        })
    }
}
