import { Component, inject } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonFab, IonFabButton, IonIcon, IonGrid, IonRow, IonCol, IonImg } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { camera } from 'ionicons/icons';
import { PhotoService, UserPhoto } from '../services/photo.service';
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [IonImg, IonCol, IonRow, IonIcon, IonFabButton, IonFab, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid]
})
export class Tab2Page {

  public photoService: PhotoService = inject(PhotoService);

  constructor() {
    addIcons({ camera });
  }

  ngOnInit() {
    this.photoService.loadSaved();
  }

  addPhotoToGallery() {
    this.photoService.addNewToGallery();
  }

  public async showActionSheet(photo: UserPhoto, position: number) {
    console.log("Entra in showActionSheet");
    const actionSheet = await ActionSheet.showActions({
      title: 'Photos',
      cancelable: true,
      options: [
        {
          title: 'Delete',
          style: ActionSheetButtonStyle.Destructive,
          icon: 'trash',
        },
        {
          title: 'Cancel',
          icon: 'close',
          style: ActionSheetButtonStyle.Cancel,
        },
      ],
    });
    if (actionSheet.index == 0) {
      this.photoService.deletePhoto(photo, position);
    }
  }
}
