import initSqlJs from 'sql.js';
import type { Database, SqlValue } from 'sql.js';

const STORAGE_KEY = 'synapse-studio.sqlite.v1';
const DAY_MS = 86_400_000;
const MAX_LOG_ENTRIES = 60;

export type SqlOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'SCHEMA' | 'OTHER';

export interface SqlLogEntry {
  id: number;
  operation: SqlOperation;
  sql: string;
  params: SqlValue[];
  at: string;
  durationMs: number;
  rows?: number;
  changes?: number;
  source?: 'seed' | 'migration';
}

export interface PersistenceState {
  ok: boolean;
  savedAt: string | null;
  bytes: number;
  error: string | null;
}

export interface ExecuteResult {
  changes: number;
  lastInsertRowid: number;
}

type SqlLogListener = (entry: SqlLogEntry) => void;
type PersistenceListener = (state: PersistenceState) => void;

let database: Database | null = null;
let initPromise: Promise<void> | null = null;
let logSequence = 0;

const queryLog: SqlLogEntry[] = [];
const logListeners = new Set<SqlLogListener>();
const persistenceListeners = new Set<PersistenceListener>();

let persistence: PersistenceState = {
  ok: true,
  savedAt: null,
  bytes: 0,
  error: null,
};

const SEED_ARTWORKS = [
  {
    title: 'Deriva orbital',
    artist: 'Elena Vásquez',
    algorithm: 'Nebulosa Espiral',
    palette: 'Cyberpunk',
    seed: 0x7a3f21c4,
    complexity: 82,
    daysAgo: 2,
  },
  {
    title: 'Canto de las cuerdas',
    artist: 'Mateo Ríos',
    algorithm: 'Ondas de Lissajous',
    palette: 'Solaris',
    seed: 0x1b9e4d2a,
    complexity: 67,
    daysAgo: 5,
  },
  {
    title: 'Estructura para un silencio',
    artist: 'Synapse Curator',
    algorithm: 'Bauhaus Grid',
    palette: 'Terracota',
    seed: 0xe41a6b90,
    complexity: 54,
    daysAgo: 9,
  },
  {
    title: 'Cartografía del vacío',
    artist: 'Lía Nakamura',
    algorithm: 'Constelación Geométrica',
    palette: 'Nordic',
    seed: 0x5c82f07d,
    complexity: 73,
    daysAgo: 14,
  },
] as const;

function classify(sql: string): SqlOperation {
  const keyword = sql.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? '';
  switch (keyword) {
    case 'SELECT':
    case 'PRAGMA':
      return 'SELECT';
    case 'INSERT':
    case 'REPLACE':
      return 'INSERT';
    case 'UPDATE':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    case 'CREATE':
    case 'ALTER':
    case 'DROP':
      return 'SCHEMA';
    default:
      return 'OTHER';
  }
}

function publishLog(entry: SqlLogEntry): void {
  queryLog.push(entry);
  if (queryLog.length > MAX_LOG_ENTRIES) {
    queryLog.splice(0, queryLog.length - MAX_LOG_ENTRIES);
  }
  for (const listener of logListeners) {
    listener(entry);
  }
}

function createLog(
  sql: string,
  params: SqlValue[],
  durationMs: number,
  extra: Pick<SqlLogEntry, 'rows' | 'changes' | 'source'> = {},
): SqlLogEntry {
  logSequence += 1;
  return {
    id: logSequence,
    operation: classify(sql),
    sql: sql.trim().replace(/\s+/g, ' '),
    params: [...params],
    at: new Date().toISOString(),
    durationMs: Math.round(durationMs * 100) / 100,
    ...extra,
  };
}

function requireDatabase(): Database {
  if (!database) {
    throw new Error('SQLite todavía no está inicializado.');
  }
  return database;
}

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

function safeStorageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sin acceso al almacenamiento: la sesión seguirá funcionando en memoria.
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function notifyPersistence(): void {
  for (const listener of persistenceListeners) {
    listener(persistence);
  }
}

/** Serializa el binario completo de SQLite y lo guarda en localStorage. */
function persist(): void {
  if (!database) {
    return;
  }

  try {
    const binary = database.export();
    const encoded = bytesToBase64(binary);
    safeStorageSet(STORAGE_KEY, encoded);
    persistence = {
      ok: true,
      savedAt: new Date().toISOString(),
      bytes: binary.byteLength,
      error: null,
    };
  } catch (error) {
    persistence = {
      ...persistence,
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo persistir la base de datos.',
    };
  }

  notifyPersistence();
}

function createSchema(db: Database): void {
  const statements = [
    `CREATE TABLE IF NOT EXISTS artworks (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT NOT NULL,
       artist TEXT NOT NULL,
       algorithm TEXT NOT NULL,
       palette TEXT NOT NULL,
       seed INTEGER NOT NULL,
       complexity INTEGER NOT NULL,
       created_at TEXT NOT NULL
     )`,
    'CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_artworks_palette ON artworks (palette)',
    'CREATE INDEX IF NOT EXISTS idx_artworks_algorithm ON artworks (algorithm)',
  ];

  for (const sql of statements) {
    const started = performance.now();
    db.run(sql);
    publishLog(
      createLog(sql, [], performance.now() - started, {
        source: 'migration',
        changes: 0,
      }),
    );
  }
}

function seedIfEmpty(db: Database): void {
  const result = db.exec('SELECT COUNT(*) AS total FROM artworks');
  const total = Number(result[0]?.values[0]?.[0] ?? 0);
  if (total > 0) {
    return;
  }

  const sql = `INSERT INTO artworks (title, artist, algorithm, palette, seed, complexity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`;

  for (const seed of SEED_ARTWORKS) {
    const params: SqlValue[] = [
      seed.title,
      seed.artist,
      seed.algorithm,
      seed.palette,
      seed.seed,
      seed.complexity,
      new Date(Date.now() - seed.daysAgo * DAY_MS).toISOString(),
    ];

    const started = performance.now();
    db.run(sql, params);
    publishLog(
      createLog(sql, params, performance.now() - started, {
        source: 'seed',
        changes: db.getRowsModified(),
      }),
    );
  }
}

async function boot(): Promise<void> {
  const SQL = await initSqlJs({
    // sql.js solicita un nombre de archivo distinto según el build; servimos
    // siempre la copia local de public/ para evitar rutas rotas y CORS.
    locateFile: (file: string) => (file.endsWith('.wasm') ? new URL('sql-wasm.wasm', document.baseURI).href : file),
  });

  const stored = safeStorageGet(STORAGE_KEY);
  let restored: Database | null = null;

  if (stored) {
    try {
      const bytes = base64ToBytes(stored);
      if (bytes.byteLength > 16) {
        restored = new SQL.Database(bytes);
      }
    } catch {
      safeStorageRemove(STORAGE_KEY);
    }
  }

  try {
    database = restored ?? new SQL.Database();
    database.run('PRAGMA foreign_keys = ON;');
    createSchema(database);
    seedIfEmpty(database);
    persist();
  } catch (error) {
    if (restored) {
      // La copia local está corrupta: se reconstruye un archivo limpio.
      safeStorageRemove(STORAGE_KEY);
      database = new SQL.Database();
      createSchema(database);
      seedIfEmpty(database);
      persist();
    } else {
      database = null;
      throw error;
    }
  }
}

/** Inicializa sql.js, restaura la copia local y garantiza esquema + seed. */
export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = boot();
  }
  return initPromise;
}

export function isDatabaseReady(): boolean {
  return database !== null;
}

export function queryAll<T>(sql: string, params: SqlValue[] = []): T[] {
  const db = requireDatabase();
  const started = performance.now();
  const statement = db.prepare(sql);

  try {
    if (params.length > 0) {
      statement.bind(params);
    }

    const rows: T[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as unknown as T);
    }

    publishLog(
      createLog(sql, params, performance.now() - started, {
        rows: rows.length,
      }),
    );

    return rows;
  } finally {
    statement.free();
  }
}

export function execute(sql: string, params: SqlValue[] = []): ExecuteResult {
  const db = requireDatabase();
  const started = performance.now();

  db.run(sql, params);
  const changes = db.getRowsModified();

  let lastInsertRowid = 0;
  if (classify(sql) === 'INSERT') {
    const result = db.exec('SELECT last_insert_rowid() AS id');
    lastInsertRowid = Number(result[0]?.values[0]?.[0] ?? 0);
  }

  publishLog(
    createLog(sql, params, performance.now() - started, {
      changes,
    }),
  );

  persist();

  return { changes, lastInsertRowid };
}

export function getQueryLog(): readonly SqlLogEntry[] {
  return queryLog;
}

export function subscribeToQueryLog(listener: SqlLogListener): () => void {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

export function getPersistenceState(): PersistenceState {
  return persistence;
}

export function subscribeToPersistence(listener: PersistenceListener): () => void {
  persistenceListeners.add(listener);
  return () => {
    persistenceListeners.delete(listener);
  };
}
