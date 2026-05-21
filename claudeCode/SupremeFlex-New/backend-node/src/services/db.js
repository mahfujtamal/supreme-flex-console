import mysql from 'mysql2/promise';
import { uuidv7 } from 'uuidv7';

export const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     process.env.DB_PORT     || 3306,
  database: process.env.DB_DATABASE || 'supremeflex',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Generate a new UUIDv7 as a 16-byte Buffer for BINARY(16) INSERT. */
export function newId() {
    return Buffer.from(uuidv7().replace(/-/g, ''), 'hex');
}

/** Convert UUID string "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" to 16-byte Buffer for WHERE clauses. */
export function toBin(uuidStr) {
    if (!UUID_RE.test(uuidStr)) {
        const err = new Error(`Invalid UUID: ${uuidStr}`);
        err.status = 422;
        throw err;
    }
    return Buffer.from(uuidStr.replace(/-/g, ''), 'hex');
}

/** Convert 16-byte Buffer back to UUID string "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx". */
export function fromBin(buf) {
    const hex = buf.toString('hex');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
