import { execute, queryAll } from '../db/database';

/** Catálogo canónico de algoritmos. El texto se guarda tal cual en SQLite. */
export const ALGORITHMS = [
  'Constelación Geométrica',
  'Ondas de Lissajous',
  'Bauhaus Grid',
  'Nebulosa Espiral',
] as const;

export type Algorithm = (typeof ALGORITHMS)[number];

/** Catálogo canónico de paletas curadas. */
export const PALETTES = ['Cyberpunk', 'Terracota', 'Nordic', 'Solaris', 'Monocromo'] as const;

export type Palette = (typeof PALETTES)[number];

export const ALGORITHM_COPY: Record<Algorithm, string> = {
  'Constelación Geométrica': 'Redes de nodos, órbitas y trazos estelares.',
  'Ondas de Lissajous': 'Curvas armónicas que se cruzan con luz aditiva.',
  'Bauhaus Grid': 'Geometría plana, arcos y bloques de color.',
  'Nebulosa Espiral': 'Miles de partículas orbitando un núcleo luminoso.',
};

export const PALETTE_COPY: Record<Palette, string> = {
  Cyberpunk: 'Neón eléctrico y magenta',
  Terracota: 'Arcilla, desierto y cobre',
  Nordic: 'Hielo, niebla y pino',
  Solaris: 'Ámbar, fuego y sol',
  Monocromo: 'Grafito, nieve y plata',
};

export const COMPLEXITY_MIN = 10;
export const COMPLEXITY_MAX = 100;

/** Registro tal como vive en la tabla `artworks`. */
export interface Artwork {
  id: number;
  title: string;
  artist: string;
  algorithm: Algorithm;
  palette: Palette;
  /** Entero sin signo de 32 bits que garantiza la reproducibilidad. */
  seed: number;
  complexity: number;
  createdAt: string;
}

/** Datos necesarios para crear una obra. */
export interface ArtworkDraft {
  title: string;
  artist: string;
  algorithm: Algorithm;
  palette: Palette;
  seed: number;
  complexity: number;
}

/** Campos editables de la ficha técnica. */
export interface ArtworkPatch {
  title: string;
  artist: string;
  palette: Palette;
}

export interface ArtworkFilters {
  query?: string;
  palette?: Palette | null;
  algorithm?: Algorithm | null;
}

interface ArtworkRow {
  id: number;
  title: string;
  artist: string;
  algorithm: string;
  palette: string;
  seed: number;
  complexity: number;
  created_at: string;
}

function isAlgorithm(value: string): value is Algorithm {
  return (ALGORITHMS as readonly string[]).includes(value);
}

function isPalette(value: string): value is Palette {
  return (PALETTES as readonly string[]).includes(value);
}

function toArtwork(row: ArtworkRow): Artwork {
  return {
    id: Number(row.id),
    title: String(row.title),
    artist: String(row.artist),
    algorithm: isAlgorithm(row.algorithm) ? row.algorithm : ALGORITHMS[0],
    palette: isPalette(row.palette) ? row.palette : PALETTES[0],
    seed: Number(row.seed) >>> 0,
    complexity: Math.min(COMPLEXITY_MAX, Math.max(COMPLEXITY_MIN, Number(row.complexity))),
    createdAt: String(row.created_at),
  };
}

/**
 * Modelo de datos. Todas las consultas usan parámetros vinculados (`?`) y
 * devuelven entidades tipadas, nunca filas crudas.
 */
export class ArtworkModel {
  static list(filters: ArtworkFilters = {}): Artwork[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    const query = filters.query?.trim();
    if (query) {
      clauses.push('(instr(lower(title), lower(?)) > 0 OR instr(lower(artist), lower(?)) > 0)');
      params.push(query, query);
    }

    if (filters.palette) {
      clauses.push('palette = ?');
      params.push(filters.palette);
    }

    if (filters.algorithm) {
      clauses.push('algorithm = ?');
      params.push(filters.algorithm);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = queryAll<ArtworkRow>(
      `SELECT id, title, artist, algorithm, palette, seed, complexity, created_at
         FROM artworks
         ${where}
        ORDER BY datetime(created_at) DESC, id DESC`,
      params,
    );

    return rows.map(toArtwork);
  }

  static findById(id: number): Artwork | null {
    const rows = queryAll<ArtworkRow>(
      `SELECT id, title, artist, algorithm, palette, seed, complexity, created_at
         FROM artworks
        WHERE id = ?
        LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? toArtwork(row) : null;
  }

  static count(): number {
    const rows = queryAll<{ total: number }>('SELECT COUNT(*) AS total FROM artworks');
    return Number(rows[0]?.total ?? 0);
  }

  static create(draft: ArtworkDraft): Artwork {
    const title = draft.title.trim();
    const artist = draft.artist.trim();

    if (!title) {
      throw new Error('El título de la obra es obligatorio.');
    }
    if (!artist) {
      throw new Error('El nombre del autor es obligatorio.');
    }

    const complexity = Math.round(draft.complexity);
    if (!Number.isFinite(complexity) || complexity < COMPLEXITY_MIN || complexity > COMPLEXITY_MAX) {
      throw new Error(`La complejidad debe estar entre ${COMPLEXITY_MIN} y ${COMPLEXITY_MAX}.`);
    }
    if (!isAlgorithm(draft.algorithm)) {
      throw new Error('El algoritmo seleccionado no es válido.');
    }
    if (!isPalette(draft.palette)) {
      throw new Error('La paleta seleccionada no es válida.');
    }

    const createdAt = new Date().toISOString();
    const result = execute(
      `INSERT INTO artworks (title, artist, algorithm, palette, seed, complexity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, artist, draft.algorithm, draft.palette, draft.seed >>> 0, complexity, createdAt],
    );

    const artwork = ArtworkModel.findById(result.lastInsertRowid);
    if (!artwork) {
      throw new Error('No se pudo recuperar la obra recién insertada.');
    }
    return artwork;
  }

  static update(id: number, patch: ArtworkPatch): Artwork {
    const title = patch.title.trim();
    const artist = patch.artist.trim();

    if (!title) {
      throw new Error('El título de la obra es obligatorio.');
    }
    if (!artist) {
      throw new Error('El nombre del autor es obligatorio.');
    }
    if (!isPalette(patch.palette)) {
      throw new Error('La paleta seleccionada no es válida.');
    }

    execute('UPDATE artworks SET title = ?, artist = ?, palette = ? WHERE id = ?', [
      title,
      artist,
      patch.palette,
      id,
    ]);

    const artwork = ArtworkModel.findById(id);
    if (!artwork) {
      throw new Error('La obra ya no existe en la base de datos.');
    }
    return artwork;
  }

  static delete(id: number): boolean {
    const result = execute('DELETE FROM artworks WHERE id = ?', [id]);
    return result.changes > 0;
  }
}
