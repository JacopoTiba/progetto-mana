// DataStorageService - Adattamento Angular di myAxios.js (lib/myAxios.js)
// Wrapper HTTP che replica la funzionalità di Ajax/sendRequest usando HttpClient di Angular
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment.development';

@Injectable({
    providedIn: 'root',
})
export class DataStorageService {
    private http = inject(HttpClient);
    private REST_API_SERVER = environment.serverUrl;

    // Corrisponde a ajax.sendRequest(method, url, parameters) di myAxios.js
    public InviaRichiesta(method: string, resource: string, params: any = {}) {
        let url = this.REST_API_SERVER + resource;

        switch (method.toLowerCase()) {
            case 'get':
                return this.http.get(url, { params, withCredentials: true });

            case 'post':
                return this.http.post(url, params, { withCredentials: true });

            case 'put':
                return this.http.put(url, params, { withCredentials: true });

            case 'patch':
                return this.http.patch(url, params, { withCredentials: true });

            case 'delete':
                return this.http.delete(url, { params, withCredentials: true });

            default:
                return undefined;
        }
    }
}
