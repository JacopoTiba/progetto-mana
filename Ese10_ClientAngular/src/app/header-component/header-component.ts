import { Component, inject, Input } from '@angular/core';
import { CommonService } from '../services/common-service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-header-component',
    imports: [FormsModule],
    templateUrl: './header-component.html',
    styleUrl: './header-component.css',
})
export class HeaderComponent {
    public commonService: CommonService = inject(CommonService);
    private router: Router = inject(Router);

    ngOnInit() {
        if (!this.commonService.username) {
            this.router.navigate(["login"]);
        }
    };

    entra() {
        if (!this.commonService.selectedRoom) {
            alert("Per favore, seleziona una stanza.");
            return;
        }
        this.router.navigate(["main"]);
    }
}
