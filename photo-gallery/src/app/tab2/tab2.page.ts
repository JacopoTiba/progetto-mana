import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonFab, IonFabButton, IonIcon, IonGrid, IonRow, IonCol, IonImg,
  IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton,
  IonBadge, IonText, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { camera, trash, chatbubble } from 'ionicons/icons';
import { PhotoService, UserPhoto } from '../services/photo.service';
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    FormsModule,
    IonImg, IonCol, IonRow, IonGrid, IonIcon, IonFabButton, IonFab,
    IonHeader, IonToolbar, IonTitle, IonContent, IonText
  ],
})
export class Tab2Page {
  public photoService = inject(PhotoService);
  private alertController = inject(AlertController);

  constructor() {
    addIcons({ camera, trash, chatbubble });
  }

  async ngOnInit() {
    await this.photoService.loadSaved();
  }

  async addPhotoToGallery() {
    await this.photoService.addNewGallery();
    // Chiedi subito il commento per la nuova foto
    const nuovaFoto = this.photoService.photos[0];
    await this.chiediCommento(nuovaFoto);
  }

  async chiediCommento(photo: UserPhoto) {
    const alert = await this.alertController.create({
      header: 'Aggiungi commento',
      message: 'Inserisci una nota per questa foto:',
      inputs: [
        {
          name: 'commento',
          type: 'text',
          placeholder: 'Es: Danno al tetto, lato nord...',
          value: photo.commento || ''
        }
      ],
      buttons: [
        { text: 'Salta', role: 'cancel' },
        {
          text: 'Salva',
          handler: (data) => {
            photo.commento = data.commento || '';
            this.photoService.salvaCommento(photo);
          }
        }
      ]
    });
    await alert.present();
  }

  async showActionSheet(photo: UserPhoto, position: number) {
    const actionSheet = await ActionSheet.showActions({
      title: 'Foto ' + (position + 1),
      options: [
        { title: 'Modifica commento', icon: 'chatbubble' },
        { title: 'Elimina', style: ActionSheetButtonStyle.Destructive, icon: 'trash' },
        { title: 'Annulla', style: ActionSheetButtonStyle.Cancel }
      ],
    });

    if (actionSheet.index === 0) {
      await this.chiediCommento(photo);
    } else if (actionSheet.index === 1) {
      await this.photoService.deletePhoto(photo, position);
    }
  }
}
