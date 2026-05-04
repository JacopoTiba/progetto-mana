//A.  Import delle librerie
import http from "http";
import url from "url";
import fs from "fs";
import express, { CookieOptions } from "express";
import dotenv from "dotenv"
import { Document, MongoClient, ObjectId, WithId } from "mongodb";
import queryStringParser from "./queryStringParser";
import cors from "cors";
import https from "https";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import cookieParser from "cookie-parser";
import e from "express";
import nodemailer from "nodemailer";
import { Server, Socket } from "socket.io";

// i parametri GET sono restituiti dentro req.query
// i parametri POST sono restituiti dentro req.body
// i parametri passati come risorsa sono restituiti dentro req.params

//B.  Configurazioni
// funzione di callback richiamata in corrispondenza di ogni richiesta al server
const app: express.Express = express();
dotenv.config({
    path: ".env"
});
const connectionString = process.env.connectionStringAtlas;
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT!);
const dbName = process.env.dbName;
const googleOAuth = JSON.parse(process.env.googleOAuth!);

//C.  Creazione ed avvio del server http
// const server = http.createServer(app);
let paginaErrore: string = "";
// Il metodo readFile non è asincrono quindi lo esegue e nel mentre va avanti
fs.readFile("./static/error.html", function (err, content) {
    if (err) {
        paginaErrore = "<h1> Risorsa non trovata </h1>"
    }
    else {
        // bisogna fare .toString() perchè content è una sequenza di byte
        paginaErrore = content.toString();
    }
});

// Creazione ed avvio sel server https
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { "key": privateKey, "cert": certificate };
const jwtKey = fs.readFileSync("keys/jwtKey", "utf-8");

let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT, function () {
    console.log("Server in ascolto sulle porta HTTPS:" + HTTPS_PORT)
});

//D.  Middleware
// 1. Request Log
app.use("/", function (req, res, next) {
    //originalUrl è la url completa richiesta dal client
    console.log(req.method + ": " + req.originalUrl);
    next();
});

// 2. Gestione risorse statiche
// lui riceve la richiesta con il file (es. index.html)
// la funzione express.static mi concatena ./static + risorsa richiesta (es. ./static + /index.html --> ./static/index.html)
app.use("/", express.static("./static"));

// 3. Lettura dei parametri post
// il json con limit indica il limite dei parametri 
// in questo caso impostiamo come limite dei parametri  5 Mb
// i parametri POST sono restituiti come json all'interno di req.body
// i parametri GET sono restituiti come json all'intenro di req.query (agganciati automaticamente perchè accodati alla url)
app.use("/", express.json({ "limit": "5mb" }));

// 4. Parsing dei parametri GET
app.use("/", queryStringParser);

// 5. Log dei parametri 
app.use("/", function (req: any, res, next) {
    if (req["parsedQuery"] && Object.keys(req["parsedQuery"]).length > 0)
        console.log("   Parametri Query: " + JSON.stringify(req["parsedQuery"]));
    if (req["body"] && Object.keys(req["body"]).length > 0)
        console.log("   Parametri Body: " + JSON.stringify(req["body"]));
    next();
});

// 6. Vincoli CORS
// accettiamo richieste da qualunque client
const whitelist = [
    "https://localhost:4200",
];

let corsOptions = {
    origin: function (origin: any, callback: any) {
        if (!origin) // browser direct call
            return callback(null, true);
        if (whitelist.indexOf(origin) == -1) {
            let msg = `The CORS policy for this site does not allow access from the specified Origin.`
            return callback(new Error(msg), false);
        }
        else
            return callback(null, true);
    },
    credentials: true
};

app.use("/", cors(corsOptions));

// 7. Parsing dei cookies
app.use(cookieParser());

// D2. Gestione login e token
const cookiesOptions: CookieOptions = {
    "path": "/", // vale per tutte le sotto-route
    "httpOnly": true, // il cookie non è visibile da javascript
    "secure": true, // il cookie è solo trasmesso su canali HTTPS
    "maxAge": parseInt(process.env.DURATA_TOKEN!) * 1000, // durata relativa a partire da ora espressa in millisecondi
    "sameSite": "none" // deve essere messo anche extra-domain (lo manda anche ai server che non appartengono allo stesso dominio della pagina)
}

// 1. Servizio di Login/Logout/Signup
// il servizio di login deve essere eseguito prima del controllo di login 
// sennò lui mi controlla il token e non mi permette mai di fare login
app.post("/api/login", async function (req, res, next) {
    const username: string = req.body.username;
    const password: string = req.body.password;

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al Database");
        return;
    });
    const db = client.db(dbName);
    const collection = client.db(dbName).collection("mails");
    // la ricerca sarà case sensitive
    const cmd = collection.findOne({ username });
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.then(function (dbUser) { // gli inietta l'intero record utente (compresa la password)
        if (!dbUser)
            res.status(401).send("Username non valido!");
        else {
            console.log("Password ricevuta:", password, "Passwors DB:", dbUser.password);
            bcrypt.compare(password, dbUser.password, function (err, ok) {
                if (err) {
                    res.status(500).send("bcrypt execution error");
                    console.log(err?.stack);
                }
                else {
                    if (!ok)
                        res.status(401).send("Password non valida!")
                    else {
                        const TOKEN = createToken(dbUser);
                        res.cookie("TOKEN", TOKEN, cookiesOptions);
                        res.send({ username });
                    }
                }
            });
        }
    });
    cmd.finally(function () {
        client.close();
    })
});

// 2. LoginWithGoogle
app.post("/api/loginWithGoogle", async function (req, res, next) {
    const googleToken = req.body.googleToken;
    const payloadGoogleToken: any = jwt.decode(googleToken);
    console.log("Google token: ", payloadGoogleToken);
    const currentCollection = "mails";


    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al Database");
        return;
    });
    const collection = client.db(dbName).collection(currentCollection);
    const cmd = collection.findOne({ "username": payloadGoogleToken.email });
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
        client.close();
    });
    cmd.then(function (dbUser) {
        if (!dbUser) {
            let password: string = "";
            for (let i = 0; i < 12; i++) {
                password += String.fromCharCode(Math.floor(Math.random() * 26) + 65); // creo una password di 12 lettere maiuscole casuali
            }

            const newUser: any = {
                "username": payloadGoogleToken.email,
                "password": bcrypt.hashSync(password, 10),
                "oldPass": password,
                "mail": []
            };

            const cmd2 = collection.insertOne(newUser);
            cmd2.catch(function (err) {
                res.status(500).send("Errore esecuzione query: " + err);
            });
            cmd2.then(function (MongoResponse) {
                newUser._id = MongoResponse.insertedId.toString();
                sendGmail(payloadGoogleToken.email, password);
                let token = createToken(newUser);
                res.cookie("TOKEN", token, cookiesOptions);
                res.send({ "username": payloadGoogleToken.email });
            });
            cmd2.finally(function () {
                client.close();
            });
        }
        else {
            let token = createToken(dbUser);
            res.cookie("TOKEN", token, cookiesOptions);
            res.send({ "username": payloadGoogleToken.email });
        }
    });
});

// 3. Servizio di SignUp
app.post("/api/signUp", async function (req: any, res, next) {
    const username = req.body.username;
    const password = req.body.password;
    const currentCollection = "mails";
    let hashedPassword = "";

    try {
        hashedPassword = await bcrypt.hash(password, 10);
    } catch (error) {
        return res.status(500).send("Errore durante la generazione dell'hash");
    }

    const client = new MongoClient(connectionString!);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(currentCollection);

        const userExists = await collection.findOne({ "username": username });
        if (userExists) {
            return res.status(409).send("Username già utilizzato");
        }

        const newUser = {
            "username": username,
            "password": hashedPassword,
            "oldPass": password,
            "mail": []
        };

        const result = await collection.insertOne(newUser);

        res.status(200).send(result);

    } catch (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    } finally {
        await client.close();
    }
});

// Controllo TOKEN
// parte solo se faccio delle api 
// app.use non fa match esatto, prende tutti i servizi che iniziano per /api
app.use("/api/", function (req: any, res, next) {
    // cookies è la collezione dei cookies
    // andiamo a vedere se nella collezione dei cookies c'è un cookie che si chiama TOKEN se esiste
    if (!req.cookies || !req.cookies.TOKEN)
        res.status(403).send("Token mancante");
    else {
        const TOKEN = req.cookies.TOKEN;
        jwt.verify(TOKEN, jwtKey, function (err: any, payload: any) {
            if (err) {
                console.log("Token non valido o scaduto");
                res.status(403).send("Token non valido o scaduto");
            }
            else {
                // ricreiamo il token aggiornando la scadenza per ogni nuova richiesta
                let newToken = createToken(payload);
                res.cookie("TOKEN", newToken, cookiesOptions);
                req["username"] = payload.username;
                next();
            }
        });
    }
});

app.post("/api/logout", async function (req: any, res, next) {
    const options = {
        // mi da tutte le chiavi dentro a cookieOptions
        ...cookiesOptions, maxAge: -1
    }
    // gli mandiamo un token vuoto con valore -1
    res.cookie("TOKEN", "", cookiesOptions);
    res.send({ "ok": 1 })
});

//################## E.  Gestione delle risorse dinamiche ##################


//F.  Default root e gestione degli errori
//  Se nessuna delle root dinamiche va a buon fine arriva qua
app.use("/", function (req, res, next) {
    if (req.originalUrl.startsWith("/api/")) {
        // servizio non trovato
        res.status(404).send("Risorsa non trovata");
    }
    else if (req.accepts("html")) { // se il client sta richiedendo una pagina html
        res.status(404).send(paginaErrore);
    }
    else
        res.sendStatus(404);
    // dovrebbe essere equivalente a res.status(404).send("");
});

//G.  Gestione degli errori
app.use("/", function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    //  err.stack mi indica l'elenco completo degli errori
    //  err.message è il messaggio riassuntivo dell'errore
    res.status(500).send(err.message)
    console.log("******** ERRORE ********: \n" + err.stack);
});

function createToken(data: any) {
    // Con .getTime() ho il tempo di ora espresso in timestampsUnix in millisecondi
    // la procedura che crea il token vuole il timestampsUnix in secondi quindi faccio diviso 1000

    const now = Math.floor(((new Date()).getTime() / 1000));
    const payload = {
        "_id": data._id,
        "username": data.username,
        "iat": data.iat || now, // se dentro a data c'è già iat allora lo lasciamo così come è sennò metto now che calcolo io
        "exp": now + parseInt(process.env.DURATA_TOKEN!)
    }
    const token = jwt.sign(payload, jwtKey);
    console.log("Creato nuovo TOKEN", token);
    return token;
}

function sendGmail(email: string, password: string) {
    let message = fs.readFileSync("./message.html", "utf-8");
    message = message.replace("__user", email);
    message = message.replace("__password", password);
    const transporter = nodemailer.createTransport({ "service": "gmail", "auth": googleOAuth });
    const mailOptions = {
        "from": googleOAuth.User,
        "to": email,
        "subject": "Nuovo account Rilievi e Perizie",
        "html": message,
        "attachments": [{ "filename": "qrCode.png", "path": "./qrCode.png" }]
    }
    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err.stack)
        }
        else {
            console.log(info);
            transporter.close();
        }
    });
}

// ##### Socket #####
// httpsServer è il server https su cui il socket va ad appoggiarsi, cors è la configurazione dei cors per il socket

// i docminic he sono abilitati a fare richeste al server http possono essere abilitati anche al socket
// non posso abilitare al socket dei domini che non sono abilitati al server http
// è possibile però abilitare dei domini al server http e alcuni domini al socket (es. se voglio che il socket sia accessibile solo da localhost e non da altri domini)
// i domini del websocket sono un sottoinsieme dei domini del server http, non possono essere più di quelli del server http

const webSocketServer = new Server(httpsServer, {
    cors: { origin: '*' }
});

webSocketServer.on("connection", function (connection) {
    let user: any = {};
    // mettere la , e non il + perchè il + concatena 
    console.log("Nuova connessione socket", connection.id);
    // quanod un client o server fa un emit con una chiave, sul server o client si genera un evento 
    // come per nome la chiave dell'emit 
    // è possibile che l'emit lo faccia il server o il client
    // se faccio l'emit e dall'altra parte non c'è il listener allora il messaggio va perso
    connection.on("JoinRoom", function (strUser: string) {
        user = JSON.parse(strUser);
        console.log(`${user.username} accepted in ${user.room}`);
        // aggiunge l'utente corrente nella stanza indicata
        // se la stanza non c'è lui la crea già in automatico
        connection.join(user.room);
        connection.emit("JoinRoomAck", "ok");
    });

    connection.on("TxtMessage", function (message: string) {
        console.log(`${user.username} : ${message}`);
        const response = {
            "from": user.username,
            "body": message,
            "date": new Date()
        };
        // per inviare una singolo risposta all'utente uso connection.emit(key, data) che è univoca per ogni utente
        // per inviare una risposta a tutti gli utenti connessi uso webSocketServer.emit(key, data) mittente compreso
        // oppure uso connection.broadcast.emit(key, data) per inviare il messggio a tutti gli utenti connessi mittente escluso

        // per inviare un messaggio a tutti gli utenti connessi ad una stanza specifica uso webSocketServer.to(nomeStanza).emit(key, data) mittente incluso
        // per inviare un messaggio a tutti gli utenti connessi ad una stanza specifica escluso il mittente uso connection.to(nomeStana).broadcast.emit(key, data) mittente escluso
        // per inviare un messaggio a un singolo utente connesso ad una stanza specifica uso connection.to(nomeStanza).emit(key, data) che è univoco per ogni utente
        webSocketServer.to(user.room).emit("NotifyMessage", JSON.stringify(response));
    });

    connection.on("disconnect", function () {
        console.log(`${user.username} disconnected`);
    });
}); 