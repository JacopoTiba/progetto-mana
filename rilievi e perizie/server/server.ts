//A.  Import delle librerie
import http from "http";
import fs from "fs";
import express, { CookieOptions } from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import queryStringParser from "./queryStringParser";
import cors from "cors";
import https from "https";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import nodemailer from "nodemailer";
import { v2 as cloudinary } from "cloudinary";

// i parametri GET sono restituiti dentro req.query
// i parametri POST sono restituiti dentro req.body
// i parametri passati come risorsa sono restituiti dentro req.params

//B.  Configurazioni
const app: express.Express = express();
dotenv.config({
  path: ".env",
});
const connectionString = process.env.connectionStringAtlas;
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT!);
const dbName = process.env.dbName;
const googleOAuth = JSON.parse(process.env.googleOAuth!);

// Configurazione Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

//C.  Creazione ed avvio del server
let paginaErrore: string = "";
fs.readFile("./static/error.html", function (err, content) {
  if (err) {
    paginaErrore = "<h1> Risorsa non trovata </h1>";
  } else {
    paginaErrore = content.toString();
  }
});

// Creazione ed avvio del server https
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { key: privateKey, cert: certificate };
const jwtKey = fs.readFileSync("keys/jwtKey", "utf-8");

let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT, function () {
  console.log("Server in ascolto sulla porta HTTPS: " + HTTPS_PORT);
});

//D.  Middleware
// 1. Request Log
app.use("/", function (req, res, next) {
  console.log(req.method + ": " + req.originalUrl);
  next();
});

// 2. Gestione risorse statiche
app.use("/", express.static("./static"));

// 3. Lettura dei parametri POST (limite 50MB per upload immagini base64)
app.use("/", express.json({ limit: "50mb" }));

// 4. Parsing dei parametri GET
app.use("/", queryStringParser);

// 5. Log dei parametri
app.use("/", function (req: any, res, next) {
  if (req["parsedQuery"] && Object.keys(req["parsedQuery"]).length > 0)
    console.log("   Parametri Query: " + JSON.stringify(req["parsedQuery"]));
  if (req["body"] && Object.keys(req["body"]).length > 0)
    console.log(
      "   Parametri Body: " + JSON.stringify(req["body"]).substring(0, 200),
    );
  next();
});

// 6. Vincoli CORS
const whitelist = [
  "https://localhost:4200",
  "http://localhost:4200",
  "https://localhost:8100",
  "http://localhost:8100",
  "capacitor://localhost",
  "http://localhost",
];

let corsOptions = {
  origin: function (origin: any, callback: any) {
    if (!origin)
      // browser direct call
      return callback(null, true);
    if (whitelist.indexOf(origin) == -1) {
      let msg = `The CORS policy for this site does not allow access from the specified Origin.`;
      return callback(new Error(msg), false);
    } else return callback(null, true);
  },
  credentials: true,
};

app.use("/", cors(corsOptions));

// 7. Parsing dei cookies
app.use(cookieParser());

// D2. Gestione login e token
const cookiesOptions: CookieOptions = {
  path: "/",
  httpOnly: true,
  secure: true,
  maxAge: parseInt(process.env.DURATA_TOKEN!) * 1000,
  sameSite: "none",
};

// =============================================
// SERVIZI PUBBLICI (prima del controllo TOKEN)
// =============================================

// 1. Servizio di Login
app.post("/api/login", async function (req, res, next) {
  const username: string = req.body.username;
  const password: string = req.body.password;

  const client = new MongoClient(connectionString!);
  await client.connect().catch(function (err) {
    res.status(503).send("Errore di connessione al Database");
    return;
  });
  const collection = client.db(dbName).collection("utenti");
  const cmd = collection.findOne({ username });
  cmd.catch(function (err) {
    res.status(500).send("Errore esecuzione query: " + err);
  });
  cmd.then(function (dbUser) {
    if (!dbUser) res.status(401).send("Username non valido!");
    else {
      bcrypt.compare(password, dbUser.password, function (err, ok) {
        if (err) {
          res.status(500).send("bcrypt execution error");
          console.log(err?.stack);
        } else {
          if (!ok) res.status(401).send("Password non valida!");
          else {
            const TOKEN = createToken(dbUser);
            res.cookie("TOKEN", TOKEN, cookiesOptions);
            res.send({ username: dbUser.username });
          }
        }
      });
    }
  });
  cmd.finally(function () {
    client.close();
  });
});

// 2. LoginWithGoogle
app.post("/api/loginWithGoogle", async function (req, res, next) {
  const googleToken = req.body.googleToken;
  const payloadGoogleToken: any = jwt.decode(googleToken);
  const userEmail = payloadGoogleToken.email;
  console.log("Tentativo Login Google: ", userEmail);

  // Controllo Whitelist su file esterno (come da specifica PDF)
  try {
    const data = fs.readFileSync("abilitati.txt", "utf8");
    const abilitati = data.split(/\r?\n/).map((e) => e.trim().toLowerCase());

    if (!abilitati.includes(userEmail.toLowerCase())) {
      console.log(`Accesso negato: ${userEmail} non è nella whitelist.`);
      res.status(403).send("Utente non abilitato. Contatta l'amministratore.");
      return;
    }
  } catch (err) {
    console.error("Errore lettura file abilitati.txt:", err);
    res
      .status(500)
      .send("Errore interno del server (configurazione whitelist)");
    return;
  }

  const client = new MongoClient(connectionString!);
  await client.connect().catch(function (err) {
    res.status(503).send("Errore di connessione al Database");
    return;
  });

  const collection = client.db(dbName).collection("utenti");
  const dbUser = await collection.findOne({ username: userEmail });

  if (!dbUser) {
    // Utente abilitato ma non ancora nel DB: lo creiamo
    console.log(`Primo accesso per ${userEmail}, creazione profilo...`);
    let password: string = ""; // Password randomica (non verrà usata per login google)
    for (let i = 0; i < 10; i++) {
      password += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
    }

    const newUser: any = {
      username: userEmail,
      password: bcrypt.hashSync(password, 10),
      info: {
        nome: payloadGoogleToken.given_name || "",
        cognome: payloadGoogleToken.family_name || "",
      },
    };

    const result = await collection.insertOne(newUser);
    newUser._id = result.insertedId.toString();

    // Per Google il token ha durata lunga (es. 1 anno = 31536000 secondi)
    const LONG_EXPIRY = 31536000;
    const token = createToken(newUser, LONG_EXPIRY);

    const longCookieOptions = { ...cookiesOptions, maxAge: LONG_EXPIRY * 1000 };
    res.cookie("TOKEN", token, longCookieOptions);
    res.send({ username: userEmail });
  } else {
    // Utente già presente e abilitato
    const LONG_EXPIRY = 31536000;
    const token = createToken(dbUser, LONG_EXPIRY);
    const longCookieOptions = { ...cookiesOptions, maxAge: LONG_EXPIRY * 1000 };
    res.cookie("TOKEN", token, longCookieOptions);
    res.send({ username: userEmail });
  }
  await client.close();
});

// =============================================
// CONTROLLO TOKEN (protegge tutte le /api/ successive)
// =============================================
app.use("/api/", function (req: any, res, next) {
  if (!req.cookies || !req.cookies.TOKEN)
    res.status(403).send("Token mancante");
  else {
    const TOKEN = req.cookies.TOKEN;
    jwt.verify(TOKEN, jwtKey, function (err: any, payload: any) {
      if (err) {
        console.log("Token non valido o scaduto");
        res.status(403).send("Token non valido o scaduto");
      } else {
        let newToken = createToken(payload);
        res.cookie("TOKEN", newToken, cookiesOptions);
        req["username"] = payload.username;
        next();
      }
    });
  }
});

// =============================================
// SERVIZI PROTETTI (dopo il controllo TOKEN)
// =============================================

// 3. Logout
app.post("/api/logout", async function (req: any, res, next) {
  const options = {
    ...cookiesOptions,
    maxAge: -1,
  };
  res.cookie("TOKEN", "", options);
  res.send({ ok: 1 });
});

// =============================================
// GESTIONE UTENTI (solo ADMIN)
// =============================================

// 4. Creazione nuovo utente (solo ADMIN)
// L'admin inserisce username (email) e info aggiuntive.
// La password viene generata casualmente dal server e inviata via email.
app.post("/api/creaUtente", async function (req: any, res, next) {
  // Verifica che l'utente sia ADMIN
  if (req["username"] !== "admin") {
    res.status(403).send("Solo l'utente ADMIN può creare nuovi utenti");
    return;
  }

  const nuovoUsername: string = req.body.username; // email del nuovo utente
  const info: any = req.body.info || {};

  // Genera password casuale di 10 caratteri
  let password: string = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const client = new MongoClient(connectionString!);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("utenti");

    // Controlla se l'utente esiste già
    const existingUser = await collection.findOne({ username: nuovoUsername });
    if (existingUser) {
      res.status(409).send("Username già esistente");
      return;
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = {
      username: nuovoUsername,
      password: hashedPassword,
      info: info,
    };

    const result = await collection.insertOne(newUser);

    // Invia la password via email al nuovo utente
    sendGmail(nuovoUsername, password);

    res.status(200).send({
      message: "Utente creato con successo. Password inviata via email.",
      insertedId: result.insertedId,
    });
  } catch (err) {
    res.status(500).send("Errore durante la creazione dell'utente: " + err);
  } finally {
    await client.close();
  }
});

// 5. Elenco utenti (solo ADMIN)
app.get("/api/utenti", async function (req: any, res, next) {
  if (req["username"] !== "admin") {
    res.status(403).send("Solo l'utente ADMIN può visualizzare gli utenti");
    return;
  }

  const client = new MongoClient(connectionString!);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("utenti");
    // Non restituiamo la password
    const utenti = await collection.find({}).project({ password: 0 }).toArray();
    res.send(utenti);
  } catch (err) {
    res.status(500).send("Errore durante la lettura degli utenti: " + err);
  } finally {
    await client.close();
  }
});

// =============================================
// GESTIONE PERIZIE
// =============================================

// 6. Elenco perizie (tutte oppure filtrate per operatore)
app.get("/api/perizie", async function (req: any, res, next) {
  const client = new MongoClient(connectionString!);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("perizie");

    let filtro: any = {};
    // Se viene passato un parametro "operatore", filtriamo per quell'utente
    if (req["parsedQuery"]?.operatore) {
      filtro.operatore = {
        $regex: req["parsedQuery"].operatore,
        $options: "i"
      };
    }

    const perizie = await collection.find(filtro).toArray();
    res.send(perizie);
  } catch (err) {
    res.status(500).send("Errore durante la lettura delle perizie: " + err);
  } finally {
    await client.close();
  }
});

// 7. Dettaglio singola perizia
app.get("/api/perizie/:id", async function (req: any, res, next) {
  const id = req.params.id;
  const client = new MongoClient(connectionString!);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("perizie");
    const perizia = await collection.findOne({ _id: new ObjectId(id) });
    if (!perizia) {
      res.status(404).send("Perizia non trovata");
    } else {
      res.send(perizia);
    }
  } catch (err) {
    res.status(500).send("Errore durante la lettura della perizia: " + err);
  } finally {
    await client.close();
  }
});

// 8. Creazione nuova perizia (dall'app mobile dell'operatore)
app.post("/api/perizie", async function (req: any, res, next) {
  const client = new MongoClient(connectionString!);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("perizie");

    const nuovaPerizia = {
      descrizione: req.body.descrizione || "",
      fotografie: [], // Le foto verranno uploadate successivamente
      operatore: req["username"], // Username dell'operatore dal token JWT
      dataOra: new Date(),
      coordinate: {
        lat: req.body.lat || 0,
        lng: req.body.lng || 0,
      },
    };

    const result = await collection.insertOne(nuovaPerizia);
    res.status(200).send({
      message: "Perizia creata con successo",
      insertedId: result.insertedId,
    });
  } catch (err) {
    res.status(500).send("Errore durante la creazione della perizia: " + err);
  } finally {
    await client.close();
  }
});

// 9. Upload immagine per una perizia (via Cloudinary)
app.post("/api/perizie/:id/foto", async function (req: any, res, next) {
  const periziaId = req.params.id;
  const imgBase64: string = req.body.img; // immagine in formato base64
  const commento: string = req.body.commento || "";

  if (!imgBase64) {
    res.status(400).send("Immagine mancante");
    return;
  }

  try {
    // Upload su Cloudinary
    const cloudinaryResponse = await cloudinary.uploader.upload(imgBase64, {
      folder: "perizie",
      timeout: 30000, // timeout 30 secondi come da specifica
    });

    // Aggiorna la perizia nel DB aggiungendo la foto al vettore
    const client = new MongoClient(connectionString!);
    await client.connect();
    const collection = client.db(dbName).collection("perizie");

    const foto = {
      url: cloudinaryResponse.secure_url,
      public_id: cloudinaryResponse.public_id,
      commento: commento,
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(periziaId) },
      { $push: { fotografie: foto } as any },
    );

    await client.close();

    if (result.matchedCount === 0) {
      res.status(404).send("Perizia non trovata");
    } else {
      res.status(200).send({
        message: "Foto caricata con successo",
        foto: foto,
      });
    }
  } catch (err) {
    res.status(500).send("Errore durante l'upload dell'immagine: " + err);
  }
});

// 10. Modifica descrizione di una perizia (solo ADMIN)
app.patch("/api/perizie/:id", async function (req: any, res, next) {
  const periziaId = req.params.id;
  const client = new MongoClient(connectionString!);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("perizie");

    const updateFields: any = {};
    if (req.body.descrizione !== undefined) {
      updateFields.descrizione = req.body.descrizione;
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(periziaId) },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      res.status(404).send("Perizia non trovata");
    } else {
      res.send({ message: "Perizia aggiornata con successo" });
    }
  } catch (err) {
    res
      .status(500)
      .send("Errore durante l'aggiornamento della perizia: " + err);
  } finally {
    await client.close();
  }
});

// 11. Modifica commento di una singola foto (solo ADMIN)
app.patch(
  "/api/perizie/:id/foto/:fotoIndex",
  async function (req: any, res, next) {
    const periziaId = req.params.id;
    const fotoIndex = parseInt(req.params.fotoIndex);
    const nuovoCommento: string = req.body.commento;

    const client = new MongoClient(connectionString!);
    try {
      await client.connect();
      const collection = client.db(dbName).collection("perizie");

      // Aggiorna il commento della foto all'indice specificato
      const updateKey = `fotografie.${fotoIndex}.commento`;
      const result = await collection.updateOne(
        { _id: new ObjectId(periziaId) },
        { $set: { [updateKey]: nuovoCommento } },
      );

      if (result.matchedCount === 0) {
        res.status(404).send("Perizia non trovata");
      } else {
        res.send({ message: "Commento aggiornato con successo" });
      }
    } catch (err) {
      res
        .status(500)
        .send("Errore durante l'aggiornamento del commento: " + err);
    } finally {
      await client.close();
    }
  },
);

// 12. Elimina perizia
app.delete("/api/perizie/:id", async function (req: any, res, next) {
  const periziaId = req.params.id;
  const client = new MongoClient(connectionString!);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("perizie");

    // Prima recupera la perizia per eliminare le foto da Cloudinary
    const perizia = await collection.findOne({ _id: new ObjectId(periziaId) });
    if (!perizia) {
      res.status(404).send("Perizia non trovata");
      return;
    }

    // Elimina le foto da Cloudinary
    if (perizia.fotografie && perizia.fotografie.length > 0) {
      for (const foto of perizia.fotografie) {
        if (foto.public_id) {
          await cloudinary.uploader
            .destroy(foto.public_id)
            .catch((err: any) => {
              console.log("Errore eliminazione foto Cloudinary: " + err);
            });
        }
      }
    }

    // Elimina la perizia dal DB
    const result = await collection.deleteOne({ _id: new ObjectId(periziaId) });
    res.send({
      message: "Perizia eliminata con successo",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).send("Errore durante l'eliminazione della perizia: " + err);
  } finally {
    await client.close();
  }
});

//F.  Default route e gestione degli errori
app.use("/", function (req, res, next) {
  if (req.originalUrl.startsWith("/api/")) {
    res.status(404).send("Risorsa non trovata");
  } else if (req.accepts("html")) {
    res.status(404).send(paginaErrore);
  } else res.sendStatus(404);
});

//G.  Gestione degli errori
app.use(
  "/",
  function (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    res.status(500).send(err.message);
    console.log("******** ERRORE ********: \n" + err.stack);
  },
);

// =============================================
// FUNZIONI UTILITY
// =============================================

function createToken(data: any, customExpiry?: number) {
  const now = Math.floor(new Date().getTime() / 1000);
  const expiry = customExpiry || parseInt(process.env.DURATA_TOKEN!);
  const payload = {
    _id: data._id,
    username: data.username,
    iat: data.iat || now,
    exp: now + expiry,
  };
  const token = jwt.sign(payload, jwtKey);
  console.log("Creato nuovo TOKEN", token);
  return token;
}

function sendGmail(email: string, password: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: googleOAuth,
  });
  const mailOptions = {
    from: googleOAuth.user,
    to: email,
    subject: "Nuovo account Rilievi e Perizie",
    html: `
      <h2>Benvenuto su Rilievi e Perizie</h2>
      <p>Il tuo account è stato creato con successo.</p>
      <p><strong>Username:</strong> ${email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>Utilizza queste credenziali per accedere all'applicazione.</p>
    `,
  };
  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log("Errore invio mail:", err.stack);
    } else {
      console.log("Email inviata:", info);
      transporter.close();
    }
  });
}
