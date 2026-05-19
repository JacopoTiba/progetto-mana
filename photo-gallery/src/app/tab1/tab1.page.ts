import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
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
    IonInput,
    IonButton,
    IonText,
    IonSpinner,
  ],
})
export class Tab1Page {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  errore = '';
  loading = false;

  constructor() {}

  get isLoggedIn() {
    return !!this.authService.username;
  }

  get currentUser() {
    return this.authService.username;
  }

  ngOnInit() {
    this.authService.loadSession();
  }

  doLogin() {
    if (!this.username || !this.password) {
      this.errore = 'Inserisci username e password';
      return;
    }
    this.errore = '';
    this.loading = true;
    this.authService.doLogin(this.username, this.password).subscribe({
      next: (data: any) => {
        this.loading = false;
        this.authService.saveSession(data.username, data.token);
        this.router.navigate(['/tabs/tab2']);
      },
      error: (err: any) => {
        this.loading = false;
        console.error('Login error', err);
        if (err.status === 401) {
          this.errore = 'Username o password non validi';
        } else if (err.status === 0) {
          this.errore =
            'Server non raggiungibile dall app. Controlla IP, porta e firewall.';
        } else {
          this.errore =
            'Errore server ' +
            err.status +
            ': ' +
            (typeof err.error === 'string' ? err.error : err.message || JSON.stringify(err.error));
        }
      },
    });
  }

  doLogout() {
    this.authService.doLogout().subscribe({
      next: () => {
        this.authService.username = '';
        this.username = '';
        this.password = '';
      },
      error: () => {
        this.authService.username = '';
      },
    });
  }
}
