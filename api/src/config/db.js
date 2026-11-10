const { MongoClient } = require('mongodb');
const C = require('./collections');

let client, db;

async function connect() {
  client = new MongoClient(
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017'
  );
  await client.connect();

  // Prioridad:
  //   1. DB_NAME       (variable propia de Express)
  //   2. MONGO_DBNAME  (variable que usa Flask → 'orioon')
  //   3. 'orioon'      (default seguro, la misma que Flask)
  const dbName =
    process.env.DB_NAME ||
    process.env.MONGO_DBNAME ||
    'orioon';

  db = client.db(dbName);

  console.log(`🗄️  MongoDB conectada → base de datos: "${dbName}"`);

  return db;
}

const getDb = () => {
  if (!db) throw new Error('Base de datos no inicializada');
  return db;
};

const col = (name) => getDb().collection(C[name] || name);

module.exports = { connect, getDb, col };