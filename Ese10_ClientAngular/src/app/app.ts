import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from "./header-component/header-component";
import { MainComponent } from './main-component/main-component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HeaderComponent],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App {
    
}
