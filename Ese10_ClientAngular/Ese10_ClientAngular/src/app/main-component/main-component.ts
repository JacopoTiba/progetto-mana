import { Component, inject } from '@angular/core';
import { CommonService } from '../services/common-service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-main-component',
  imports: [FormsModule],
  templateUrl: './main-component.html',
  styleUrl: './main-component.css',
})
export class MainComponent {
  public commonService: CommonService = inject(CommonService);
  private router: Router = inject(Router);

  public socketStatus: string = 'DISCONNETTED';
  public txtMessage: string = '';
  private wsClient: Socket | null = null;

  ngOnInit() {
    if (!this.commonService.username) {
      this.router.navigate(['login']);
      return;
    }
    this.socketStatus = 'WAITING FOR CONNECTION...';
    this.connetti();
  }

  // Crea una connessione con il websocket del server
  // gli eventi del socket sono gestiti dentro a connetti()
  // il resto degli eventi sono getsititi fuori
  connetti() {
    const serverURL = 'https://localhost:3000';
    // le options consentonon di mantenere la connessione attiva sennò dopo un po' di inattività il server chiude la connessione
    let options = {
      transports: ['websocket'],
      upgrade: false,
    };
    // invio una richiesta di connessione TCP sul socket
    this.wsClient = io(serverURL, options);

    // quando il server accetta la connessione sul client scatta l'evento connect
    this.wsClient.on('connect', () => {
      this.socketStatus = 'CONNECTED';
      const user: any = {
        username: this.commonService.username,
        room: this.commonService.selectedRoom,
      };
      console.log(user);
      this.wsClient?.emit('JoinRoom', JSON.stringify(user));
    });

    this.wsClient.on('JoinRoomAck', (data) => {
      if (data) {
        // salvo utenti della stanza
        this.commonService.roomUsers = JSON.parse(data);
        document.title = this.commonService.username;
        // elenco messaggi già presenti
        this.wsClient?.emit('askDataRoom', this.commonService.selectedRoom);
      }
    });

    this.wsClient.on('dataRoom', (data: string) => {
      const messaggi = JSON.parse(data);
      // formatta le date e carica tutti i messaggi storici
      this.commonService.messages = messaggi
        .map((msg: any) => {
          msg.date = new Date(msg.date).toLocaleTimeString();
          return msg;
        })
        .reverse();
    });

    this.wsClient.on('NotifyMessage', (data) => {
      const message = JSON.parse(data);
      console.log(data);
      // mi da data e ora locali in formato stringa
      message.date = new Date(message.date).toLocaleTimeString();
      // aggiungo il nuovo messaggio in testa alla lista dei messaggi
      this.commonService.messages.unshift(message);
    });

    // Un nuovo utente è entrato nella stanza -> aggiorno il banner
    this.wsClient.on('UserJoined', (username: string) => {
      alert(`L'utente ${username} è entrato nella stanza`);
      if (!this.commonService.roomUsers.includes(username)) {
        this.commonService.roomUsers.push(username);
      }
    });

    // Un utente è uscito dalla stanza -> aggiorno il banner
    this.wsClient.on('UserLeft', (username: string) => {
      alert(`L'utente ${username} è uscito dalla stanza`);
      this.commonService.roomUsers = this.commonService.roomUsers.filter(
        (u) => u !== username
      );
    });
  }

  imgMancante(event: any) {
    event.target.src = './img/default.jpg';
  }

  onInvia() {
    this.wsClient?.emit('TxtMessage', this.txtMessage);
    this.txtMessage = '';
  }

  onLogout() {
    this.wsClient?.disconnect();
    this.commonService.username = '';
    this.commonService.doLogout().subscribe({
      next: () => {
        alert('Sessione chiusa correttamente');
        this.router.navigate(['login']);
      },
      error: (err) => {
        alert('Sessione scaduta ripeti il login');
        this.router.navigate(['login']);
      },
    });
  }

  onEsci() {
    // Invio al server il messaggio di uscita dalla stanza prima di disconnettersi
    this.wsClient?.emit('LeaveRoom');
    this.wsClient?.disconnect();
    this.router.navigate(['header']);
  }
}
