// ============================================================
//  FutBuddies - Ligação ao SQL Server
//  Suporta Windows Authentication e SQL Authentication
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sql = require('mssql');

const usaWindowsAuth = process.env.DB_WINDOWS_AUTH === 'true';

// Azure SQL exige encrypt=true. Em local podes pôr DB_ENCRYPT=false.
const encrypt = (process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true';
const trustServerCertificate = (process.env.DB_TRUST_CERT || 'true').toLowerCase() === 'true';

// Aceita DB_SERVER (preferido) ou DB_HOST (legado). Em produção falha se ausente.
const server = process.env.DB_SERVER || process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? null : 'localhost');
if (!server) {
  console.error('❌ DB_SERVER (ou DB_HOST) é obrigatório em produção.');
  process.exit(1);
}

const dbConfig = {
  server,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'FutBuddies',
  // Windows Auth não usa user/password — usa o login do Windows
  ...(usaWindowsAuth
    ? { user: process.env.DB_USER, password: process.env.DB_PASSWORD, domain: process.env.DB_DOMAIN || '', options: { trustedConnection: true, trustServerCertificate: true, enableArithAbort: true, encrypt: false } }
    : { user: process.env.DB_USER, password: process.env.DB_PASSWORD, options: { encrypt, trustServerCertificate, enableArithAbort: true } }
  ),
  pool: { max: 25, min: 2, idleTimeoutMillis: 30000, acquireTimeoutMillis: 15000 },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool = null;
let connecting = null;

function _attachPoolListeners(p) {
  p.on('error', (err) => {
    console.error('[DB] pool error:', err.message);
    // Invalida o pool para obrigar nova ligação na próxima query.
    if (pool === p) pool = null;
  });
}

async function getPool() {
  if (pool && pool.connected) return pool;
  if (connecting) return connecting; // evita tempestade de conexões em paralelo
  connecting = (async () => {
    try {
      const p = await sql.connect(dbConfig);
      _attachPoolListeners(p);
      pool = p;
      console.log(`✅ Ligação ao SQL Server estabelecida! (${usaWindowsAuth ? 'Windows Auth' : 'SQL Auth'})`);
      return pool;
    } catch (err) {
      pool = null;
      console.error('❌ Erro ao ligar ao SQL Server:', err.message);
      console.error(`   Modo: ${usaWindowsAuth ? 'Windows Authentication' : 'SQL Authentication'}`);
      console.error('   Servidor:', server);
      console.error('   Base de dados:', process.env.DB_NAME || 'FutBuddies');
      throw err;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

// Erros de ligação (não de SQL) que justificam tentar reconectar.
function _isTransient(err) {
  if (!err) return false;
  const c = err.code || '';
  return c === 'ETIMEOUT' || c === 'ECONNCLOSED' || c === 'ECONNRESET'
      || c === 'ENOTOPEN' || c === 'ESOCKET' || c === 'ELOGIN';
}

async function query(queryString, params = {}) {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const db = await getPool();
      const request = db.request();
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) request.input(key, sql.NVarChar, null);
        else if (typeof value === 'number' && Number.isInteger(value)) request.input(key, sql.Int, value);
        else if (value instanceof Date) request.input(key, sql.DateTime2, value);
        else if (typeof value === 'boolean') request.input(key, sql.Bit, value);
        else request.input(key, sql.NVarChar, String(value));
      }
      return await request.query(queryString);
    } catch (err) {
      if (tentativa === 1 && _isTransient(err)) {
        console.warn('[DB] transient error, retry:', err.message);
        pool = null; // força nova ligação
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
      throw err;
    }
  }
}

process.on('SIGINT', async () => { if (pool) await pool.close(); process.exit(0); });

module.exports = { getPool, query, sql };
