import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { from, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private SERVER = environment.serverUrl;

  public username: string = '';
  public token: string = '';

  saveSession(username: string, token: string) {
    this.username = username;
    this.token = token;
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
  }

  loadSession() {
    this.token = localStorage.getItem('token') || '';
    this.username = localStorage.getItem('username') || '';
  }


  doLogin(username: string, password: string) {
    return from(
      CapacitorHttp.post({
        url: this.SERVER + '/login',
        headers: { 'Content-Type': 'application/json' },
        data: { username, password },
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

  doLogout() {
    this.username = '';
    return from(
      CapacitorHttp.post({
        url: this.SERVER + '/logout',
        headers: { Authorization: 'Bearer ' + this.token },
        data: {},
      }),
    ).pipe(map((response) => response.data));
  }

  // Verifica sessione (tenta una chiamata protetta)
  checkSession() {
    return this.http.get(this.SERVER + '/perizie', {
      withCredentials: true,
      headers: { 'Authorization': 'Bearer ' + this.token }
    });
  }
}
