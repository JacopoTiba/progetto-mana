export const environment = {
  production: false,

  // IP DA CAMBIARE PER IL TELEFONO:
  // questo deve essere l'IPv4 del PC visto dalla rete del telefono.
  // Lo trovi sul PC con "ipconfig" -> Scheda Wi-Fi -> Indirizzo IPv4.
  // Esempio: se il telefono fa hotspot al PC, qui va l'IP del PC sulla rete hotspot,
  // NON l'IP del telefono.
  serverUrl: 'http://10.90.159.108:3000/api',
};
