// db/mongo.js
// Conexão única (singleton) com o MongoDB, reaproveitada por toda a API.

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'curva_seguranca';

let client = null;
let db = null;

async function connect() {
  if (db) return db;

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000
  });

  await client.connect();
  db = client.db(dbName);
  await db.command({ ping: 1 });

  console.log(`[mongo] Conectado ao banco "${dbName}"`);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error(
      'MongoDB ainda não foi conectado. O servidor precisa chamar connect() com sucesso antes de aceitar requisições.'
    );
  }
  return db;
}

async function close() {
  if (client) await client.close();
  db = null;
  client = null;
}

module.exports = { connect, getDb, close };
