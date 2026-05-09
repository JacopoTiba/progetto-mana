// A. Import delle librerie
import fs from "fs";
import https from "https";
import express, { CookieOptions } from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import nodemailer from "nodemailer";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import queryStringParser from "./queryStringParser";

// B. Configurazioni
dotenv.config({ path: ".env" });
const app: express.Express = express();

const connectionString = process.env.connectionStringAtlas!;
const HTTPS_PORT       = parseInt(process.env.HTTPS_PORT!);
const dbName           = process.env.dbName!;
const jwtKey           = fs.readFileSync("keys/jwtKey", "utf-8");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key:    process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Multer: salva in memoria, poi inviamo a Cloudinary via stream
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// C. Avvio server HTTPS
let paginaErrore = "";
fs.readFile("./static/error.html", function (err, content) {
    paginaErrore = err ? "<h1>Risorsa non trovata</h1>" : content.toString();
});

const privateKey   = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate  = fs.readFileSync("keys/certificate.crt", "utf8");
const httpsServer  = https.createServer({ key: privateKey, cert: certificate }, app);

httpsServer.listen(HTTPS_PORT, function () {
    console.log("Server HTTPS in ascolto sulla porta: " + HTTPS_PORT);
});

// D. Middleware
// 1. Request log
app.use("/", function (req, res, next) {
    console.log(req.method + ": " + req.originalUrl);
    next();
});

// 2. Risorse statiche
app.use("/", express.static("./static"));

// 3. Body JSON
app.use("/", express.json({ limit: "5mb" }));

// 4. Parsing parametri GET
app.use("/", queryStringParser);

// 5. Log parametri
app.use("/", function (req: any, res, next) {
    if (req["parsedQuery"] && Object.keys(req["parsedQuery"]).length > 0)
        console.log("   Parametri Query: " + JSON.stringify(req["parsedQuery"]));
    if (req["body"] && Object.keys(req["body"]).length > 0)
        console.log("   Parametri Body: " + JSON.stringify(req["body"]));
    next();
});

// 6. CORS
const whitelist = ["https://localhost:4200"];
const corsOptions = {
    origin: function (origin: any, callback: any) {
        if (!origin) return callback(null, true);
        if (whitelist.indexOf(origin) === -1)
            return callback(new Error("CORS policy: origine non consentita"), false);
        return callback(null, true);
    },
    credentials: true,
};
app.use("/", cors(corsOptions));

// 7. Cookie parser
app.use(cookieParser());

// D2. Opzioni cookie JWT
const cookiesOptions: CookieOptions = {
    path:     "/",
    httpOnly: true,
    secure:   true,
    maxAge:   parseInt(process.env.DURATA_TOKEN!) * 1000,
    sameSite: "none",
};

// ────────────────────────────────────────────────────────────────────────────
// E. Servizi pubblici (senza controllo token)
// ────────────────────────────────────────────────────────────────────────────

// POST /api/login
app.post("/api/login", async function (req, res) {
    const username: string = req.body.username;
    const password: string = req.body.password;

    const client = new MongoClient(connectionString);
    await client.connect().catch(function () {
        res.status(503).send("Errore di connessione al Database");
        return;
    });

    const collection = client.db(dbName).collection("utenti");
    const cmd = collection.findOne({ username });

    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });

    cmd.then(function (dbUser) {
        if (!dbUser) {
            res.status(401).send("Username non valido!");
        } else {
            bcrypt.compare(password, dbUser.password, function (err, ok) {
                if (err) {
                    res.status(500).send("Errore bcrypt");
                } else if (!ok) {
                    res.status(401).send("Password non valida!");
                } else {
                    const token = createToken(dbUser);
                    res.cookie("TOKEN", token, cookiesOptions);
                    res.send({ username: dbUser.username, isAdmin: dbUser.isAdmin });
                }
            });
        }
    });

    cmd.finally(function () { client.close(); });
});

// POST /api/logout
app.post("/api/logout", function (req, res) {
    res.cookie("TOKEN", "", { ...cookiesOptions, maxAge: -1 });
    res.send({ ok: 1 });
});

// ────────────────────────────────────────────────────────────────────────────
// Controllo TOKEN — protegge tutte le /api/ successive
// ────────────────────────────────────────────────────────────────────────────
app.use("/api/", function (req: any, res, next) {
    if (!req.cookies || !req.cookies.TOKEN) {
        res.status(403).send("Token mancante");
        return;
    }
    const TOKEN = req.cookies.TOKEN;
    jwt.verify(TOKEN, jwtKey, function (err: any, payload: any) {
        if (err) {
            res.status(403).send("Token non valido o scaduto");
        } else {
            const newToken = createToken(payload);
            res.cookie("TOKEN", newToken, cookiesOptions);
            req["username"] = payload.username;
            req["isAdmin"]  = payload.isAdmin;
            next();
        }
    });
});

// ────────────────────────────────────────────────────────────────────────────
// F. Servizi protetti — UTENTI (solo admin)
// ────────────────────────────────────────────────────────────────────────────

// GET /api/utenti — lista tutti gli utenti (senza password)
app.get("/api/utenti", async function (req: any, res) {
    if (!req["isAdmin"]) { res.status(403).send("Accesso riservato agli amministratori"); return; }

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("utenti");
    const utenti = await collection.find({}, { projection: { password: 0 } }).toArray();
    await client.close();
    res.send(utenti);
});

// POST /api/utenti — crea nuovo utente (solo admin)
// Body: { username, info? }
app.post("/api/utenti", async function (req: any, res) {
    if (!req["isAdmin"]) { res.status(403).send("Accesso riservato agli amministratori"); return; }

    const username: string = req.body.username?.toLowerCase().trim();
    const info: string     = req.body.info || "";

    if (!username) { res.status(400).send("Username obbligatorio"); return; }

    const password = generaPassword();
    const hash     = await bcrypt.hash(password, 10);

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("utenti");

    const esistente = await collection.findOne({ username });
    if (esistente) {
        await client.close();
        res.status(409).send("Utente già esistente");
        return;
    }

    const nuovoUtente = { username, password: hash, info, isAdmin: false };
    await collection.insertOne(nuovoUtente);
    await client.close();

    // Invia mail con le credenziali
    try { await inviaMail(username, password); }
    catch (e) { console.log("Errore invio mail:", e); }

    res.status(201).send({ messaggio: "Utente creato, mail inviata", username });
});

// DELETE /api/utenti/:username — elimina utente (solo admin)
app.delete("/api/utenti/:username", async function (req: any, res) {
    if (!req["isAdmin"]) { res.status(403).send("Accesso riservato agli amministratori"); return; }
    if (req.params.username === req["username"]) { res.status(400).send("Non puoi eliminare te stesso"); return; }

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("utenti");
    const result = await collection.deleteOne({ username: req.params.username });
    await client.close();

    if (result.deletedCount === 0) { res.status(404).send("Utente non trovato"); return; }
    res.send({ messaggio: "Utente eliminato" });
});

// ────────────────────────────────────────────────────────────────────────────
// G. Servizi protetti — PERIZIE
// ────────────────────────────────────────────────────────────────────────────

// GET /api/perizie — admin: tutte | operatore: solo le sue
app.get("/api/perizie", async function (req: any, res) {
    const filtro = req["isAdmin"] ? {} : { username: req["username"] };

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");
    const perizie = await collection.find(filtro).sort({ dataOra: -1 }).toArray();
    await client.close();
    res.send(perizie);
});

// GET /api/perizie/utente/:username — perizie di un utente specifico (solo admin)
app.get("/api/perizie/utente/:username", async function (req: any, res) {
    if (!req["isAdmin"]) { res.status(403).send("Accesso riservato agli amministratori"); return; }

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");
    const perizie = await collection.find({ username: req.params.username }).sort({ dataOra: -1 }).toArray();
    await client.close();
    res.send(perizie);
});

// GET /api/perizie/:id — singola perizia
app.get("/api/perizie/:id", async function (req: any, res) {
    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");
    const perizia = await collection.findOne({ _id: new ObjectId(req.params.id) });
    await client.close();

    if (!perizia) { res.status(404).send("Perizia non trovata"); return; }
    if (!req["isAdmin"] && perizia.username !== req["username"]) {
        res.status(403).send("Non autorizzato"); return;
    }
    res.send(perizia);
});

// POST /api/perizie — crea nuova perizia (senza foto)
// Body: { codice, descrizione, lat, lng }
app.post("/api/perizie", async function (req: any, res) {
    const { codice, descrizione, lat, lng } = req.body;
    if (!codice || !descrizione || lat === undefined || lng === undefined) {
        res.status(400).send("Codice, descrizione e coordinate obbligatori"); return;
    }

    const nuovaPerizia = {
        codice,
        descrizione,
        foto: [],
        username:   req["username"],
        dataOra:    new Date(),
        coordinate: { lat: Number(lat), lng: Number(lng) },
    };

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");

    try {
        const result = await collection.insertOne(nuovaPerizia);
        await client.close();
        res.status(201).send({ ...nuovaPerizia, _id: result.insertedId });
    } catch (err: any) {
        await client.close();
        if (err.code === 11000) res.status(409).send("Codice perizia già esistente");
        else res.status(500).send("Errore creazione perizia");
    }
});

// POST /api/perizie/:id/foto — aggiunge una foto (upload su Cloudinary)
// FormData: { foto: File, commento?: string }
app.post("/api/perizie/:id/foto", upload.single("foto"), async function (req: any, res) {
    if (!req.file) { res.status(400).send("Nessuna foto inviata"); return; }

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");
    const perizia = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!perizia) { await client.close(); res.status(404).send("Perizia non trovata"); return; }
    if (!req["isAdmin"] && perizia.username !== req["username"]) {
        await client.close(); res.status(403).send("Non autorizzato"); return;
    }

    try {
        const { url, publicId } = await uploadToCloudinary(req.file.buffer);
        const nuovaFoto = { url, publicId, commento: req.body.commento || "" };
        await collection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { foto: nuovaFoto } }
        );
        await client.close();
        res.send({ messaggio: "Foto aggiunta", foto: nuovaFoto });
    } catch (err) {
        await client.close();
        res.status(500).send("Errore upload foto");
    }
});

// PATCH /api/perizie/:id — modifica descrizione
// Body: { descrizione }
app.patch("/api/perizie/:id", async function (req: any, res) {
    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");
    const perizia = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!perizia) { await client.close(); res.status(404).send("Perizia non trovata"); return; }
    if (!req["isAdmin"] && perizia.username !== req["username"]) {
        await client.close(); res.status(403).send("Non autorizzato"); return;
    }

    await collection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { descrizione: req.body.descrizione } }
    );
    await client.close();
    res.send({ messaggio: "Perizia aggiornata" });
});

// PATCH /api/perizie/:id/foto/:fotoIndex — modifica commento di una foto
// Body: { commento }
app.patch("/api/perizie/:id/foto/:fotoIndex", async function (req: any, res) {
    const idx = parseInt(req.params.fotoIndex);
    if (isNaN(idx) || idx < 0) { res.status(400).send("Indice foto non valido"); return; }

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");
    const perizia = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!perizia) { await client.close(); res.status(404).send("Perizia non trovata"); return; }
    if (!req["isAdmin"] && perizia.username !== req["username"]) {
        await client.close(); res.status(403).send("Non autorizzato"); return;
    }
    if (idx >= perizia.foto.length) {
        await client.close(); res.status(400).send("Indice foto fuori range"); return;
    }

    const campo = `foto.${idx}.commento`;
    await collection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { [campo]: req.body.commento } }
    );
    await client.close();
    res.send({ messaggio: "Commento aggiornato" });
});

// DELETE /api/perizie/:id/foto/:fotoIndex — elimina foto (solo admin)
app.delete("/api/perizie/:id/foto/:fotoIndex", async function (req: any, res) {
    if (!req["isAdmin"]) { res.status(403).send("Accesso riservato agli amministratori"); return; }
    const idx = parseInt(req.params.fotoIndex);

    const client = new MongoClient(connectionString);
    await client.connect().catch(() => res.status(503).send("Errore DB"));
    const collection = client.db(dbName).collection("perizie");
    const perizia = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!perizia) { await client.close(); res.status(404).send("Perizia non trovata"); return; }
    if (isNaN(idx) || idx < 0 || idx >= perizia.foto.length) {
        await client.close(); res.status(400).send("Indice foto non valido"); return;
    }

    // Elimina da Cloudinary
    try { await cloudinary.uploader.destroy(perizia.foto[idx].publicId); }
    catch (e) { console.log("Errore eliminazione Cloudinary:", e); }

    // Rimuove la foto dall'array con $unset + $pull
    const campo = `foto.${idx}`;
    await collection.updateOne({ _id: new ObjectId(req.params.id) }, { $unset: { [campo]: 1 } });
    await collection.updateOne({ _id: new ObjectId(req.params.id) }, { $pull: { foto: null } });
    await client.close();
    res.send({ messaggio: "Foto eliminata" });
});

// ────────────────────────────────────────────────────────────────────────────
// H. Default e gestione errori
// ────────────────────────────────────────────────────────────────────────────
app.use("/", function (req, res) {
    if (req.originalUrl.startsWith("/api/")) res.status(404).send("Servizio non trovato");
    else if (req.accepts("html")) res.status(404).send(paginaErrore);
    else res.sendStatus(404);
});

app.use("/", function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    res.status(500).send(err.message);
    console.log("******** ERRORE ********:\n" + err.stack);
});

// ────────────────────────────────────────────────────────────────────────────
// Funzioni helper
// ────────────────────────────────────────────────────────────────────────────

function createToken(data: any) {
    const now = Math.floor(new Date().getTime() / 1000);
    const payload = {
        _id:      data._id,
        username: data.username,
        isAdmin:  data.isAdmin || false,
        iat:      data.iat || now,
        exp:      now + parseInt(process.env.DURATA_TOKEN!),
    };
    const token = jwt.sign(payload, jwtKey);
    console.log("Creato nuovo TOKEN per:", payload.username);
    return token;
}

function generaPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++)
        pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
}

async function inviaMail(destinatario: string, password: string): Promise<void> {
    const googleOAuth = JSON.parse(process.env.googleOAuth!);
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: googleOAuth,
    });
    await transporter.sendMail({
        from:    `"Rilievi e Perizie" <${googleOAuth.user}>`,
        to:      destinatario,
        subject: "Le tue credenziali di accesso",
        html:    `<p>Benvenuto!</p><p><b>Username:</b> ${destinatario}<br><b>Password:</b> ${password}</p>`,
    });
}

function uploadToCloudinary(buffer: Buffer): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "rilievi_perizie", transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }] },
            (error, result) => {
                if (error || !result) return reject(error);
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );
        Readable.from(buffer).pipe(stream);
    });
}