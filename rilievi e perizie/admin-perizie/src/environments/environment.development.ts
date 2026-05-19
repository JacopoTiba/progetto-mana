export const environment = {
  production: false,
  googleClientId: '419438233450-791fqnvb3ron16scaernl0nglumg3vo8.apps.googleusercontent.com',

  // URL PER L'ADMIN ANGULAR USATO DAL PC:
  // se apri l'admin dal PC con "ng serve", lascia localhost.
  // Qui NON va l'IP del telefono: il browser del PC si collega al server sul PC.
  // Cambialo con "http://IP_DEL_PC:3000/api" solo se vuoi aprire l'admin da un altro dispositivo.
  serverUrl: 'http://localhost:3000/api',
};
