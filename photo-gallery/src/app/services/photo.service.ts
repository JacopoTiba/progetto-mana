import { inject, Injectable } from '@angular/core';
import { Camera, CameraDirection, MediaResult } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE: string = 'photos';
  private platform: Platform = inject(Platform);

  public async addNewGallery() {
    const capturedPhoto = await Camera.takePhoto({
      cameraDirection: CameraDirection.Rear, // fotocamera posteriore per perizie
      quality: 80 // qualità ridotta per upload più veloce
    });

    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);
    await this.salvaTutto();
  }

  private async savePicture(capturedPhoto: MediaResult) {
    let base64Data: string | Blob;

    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({ path: capturedPhoto.uri! });
      base64Data = file.data;
    } else {
      const response = await fetch(capturedPhoto.webPath!);
      const blob = await response.blob();
      base64Data = (await this.convertBlobToBase64(blob)) as string;
    }

    const fileName = Date.now() + '.jpg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (this.platform.is('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
        commento: ''
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: capturedPhoto.webPath,
        commento: ''
      };
    }
  }

  private convertBlobToBase64(blob: Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // Salva il commento di una foto e aggiorna il cache
  public async salvaCommento(photo: UserPhoto) {
    await this.salvaTutto();
  }

  // Salva tutto l'array nelle Preferences
  private async salvaTutto() {
    await Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });
  }

  public async loadSaved() {
    const { value: photoList } = await Preferences.get({ key: this.PHOTO_STORAGE });
    this.photos = (photoList ? JSON.parse(photoList) : []) as UserPhoto[];

    if (!this.platform.is('hybrid')) {
      for (let photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data,
        });
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  public async deletePhoto(photo: UserPhoto, position: number) {
    this.photos.splice(position, 1);
    await this.salvaTutto();

    const filename = photo.filepath.slice(photo.filepath.lastIndexOf('/') + 1);
    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data,
    }).catch(() => {}); // ignora se il file non esiste
  }

  // Svuota tutta la galleria dopo upload riuscito
  public async svuotaGalleria() {
    for (const photo of this.photos) {
      const filename = photo.filepath.slice(photo.filepath.lastIndexOf('/') + 1);
      await Filesystem.deleteFile({
        path: filename,
        directory: Directory.Data,
      }).catch(() => {});
    }
    this.photos = [];
    await this.salvaTutto();
  }
}

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
  commento?: string;
}
