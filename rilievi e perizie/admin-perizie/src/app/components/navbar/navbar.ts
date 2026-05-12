import { Component, inject } from '@angular/core';
import { Auth } from '../../services/auth';
import { Router, RouterLink } from '@angular/router';

@Component({
    selector: 'app-navbar',
    imports: [RouterLink],
    templateUrl: './navbar.html',
    styleUrl: './navbar.css',
})
export class Navbar {
    public authService: Auth = inject(Auth);
    private router: Router = inject(Router);

    onLogout() {
        this.authService.doLogout().subscribe({
            next: () => {
                this.authService.username = "";
                this.router.navigate(["login"]);
            },
            error: (err: any) => {
                this.authService.username = "";
                this.router.navigate(["login"]);
            }
        });
    }
}
