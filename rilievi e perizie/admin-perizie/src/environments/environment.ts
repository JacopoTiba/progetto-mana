export const environment = {
  production: true,
  googleClientId: '419438233450-791fqnvb3ron16scaernl0nglumg3vo8.apps.googleusercontent.com',

  // URL PER L'ADMIN ANGULAR IN BUILD PRODUZIONE SUL PC:
  // localhost funziona quando il server Express gira sullo stesso PC.
  // Se un giorno pubblichi admin e server sullo stesso dominio, puoi rimettere "/api".
  // Se apri questa build da un altro dispositivo, usa "http://IP_DEL_PC:3000/api".
  serverUrl: 'http://localhost:3000/api'
};
