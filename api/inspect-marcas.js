const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/';
const DB = 'orioon';

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(DB);

    console.log('\n═══════════════════════════════════════════');
    console.log(`📦 Base de datos: ${DB}`);
    console.log('═══════════════════════════════════════════\n');

    // 1) Listar todas las colecciones con su conteo
    const cols = await db.listCollections().toArray();
    const nombres = cols.map((c) => c.name).sort();

    console.log('🗂  Colecciones disponibles:');
    for (const n of nombres) {
      const count = await db.collection(n).countDocuments();
      console.log(`   ${count.toString().padStart(6)}  ${n}`);
    }

    // 2) Analizar candidatas de "marcas"
    console.log('\n═══════════════════════════════════════════');
    console.log('🔎 Analizando candidatas de "marcas"...');
    console.log('═══════════════════════════════════════════\n');

    const candidatas = ['marcas', 'empresas', 'marca', 'empresas_marcas', 'brands'];

    for (const nombre of candidatas) {
      if (!nombres.includes(nombre)) {
        console.log(`❌ "${nombre}" → no existe`);
        continue;
      }

      const count = await db.collection(nombre).countDocuments();
      console.log(`\n✅ "${nombre}" → ${count} documento(s)`);

      if (count > 0) {
        const ejemplo = await db.collection(nombre).findOne({});
        console.log('   Ejemplo (primer doc):');
        console.log('   ', JSON.stringify(ejemplo, null, 2).split('\n').join('\n    '));
      }
    }

    // 3) Campos de relación en productos
    console.log('\n═══════════════════════════════════════════');
    console.log('📋 Productos — campos de relación:');
    console.log('═══════════════════════════════════════════\n');
    const p = await db.collection('productos').findOne({});
    if (p) {
      const campos = ['marca_id', 'empresa_id', 'marca', 'empresa'];
      campos.forEach((c) => {
        if (p[c] !== undefined) console.log(`   ${c}: ${JSON.stringify(p[c])}`);
      });
    }

    console.log('\n✅ Listo. Copia la salida completa.');
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await client.close();
    process.exit(0);
  }
})();