import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

async function init() {
  const client = new MongoClient(process.env.connectionStringAtlas!);
  try {
    await client.connect();
    const db = client.db(process.env.dbName);
    const collection = db.collection("utenti");

    const adminPassword = "admin"; // Cambiala se vuoi
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);

    const adminUser = {
      username: "admin",
      password: hashedPassword,
      info: { nome: "Amministratore", ruolo: "admin" },
    };

    const result = await collection.updateOne(
      { username: "admin" },
      { $set: adminUser },
      { upsert: true },
    );

    console.log("Utente admin creato/aggiornato con successo!");
    console.log("Username: admin");
    console.log("Password: " + adminPassword);
  } catch (err) {
    console.error("Errore durante l'inizializzazione:", err);
  } finally {
    await client.close();
  }
}
init();
