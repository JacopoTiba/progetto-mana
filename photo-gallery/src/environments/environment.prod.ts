export const environment = {
  production: true,

  // IP DA CAMBIARE PER L'APP INSTALLATA SUL TELEFONO:
  // questo deve essere l'IPv4 del PC che esegue il server Express.
  // Lo trovi sul PC con "ipconfig" -> Scheda Wi-Fi -> Indirizzo IPv4.
  // Se cambi rete/hotspot, probabilmente cambia anche questo IP.
  // Dopo averlo cambiato devi rifare:
  // npm run build
  // npx cap sync android
  // npx cap run android
  serverUrl: 'http://10.90.159.108:3000/api',
};
