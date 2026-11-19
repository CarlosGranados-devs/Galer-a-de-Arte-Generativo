import {
  ALGORITHMS,
  ALGORITHM_COPY,
  PALETTES,
  type Algorithm,
  type Artwork,
  type ArtworkFilters,
  type ArtworkPatch,
  type Palette,
} from '../models/ArtworkModel';
import type { PersistenceState, SqlLogEntry } from '../db/database';
import {
  PALETTE_DEFINITIONS,
  createRandomSeed,
  renderArtwork,
  seedToHex,
  type ArtworkSpec,
} from '../utils/generative';

export type CardAction = 'view' | 'download' | 'edit' | 'delete';
export type ToastVariant = 'success' | 'error' | 'info';

export interface StudioInput {
  title: string;
  artist: string;
  algorithm: Algorithm;
  palette: Palette;
  seed: number;
  complexity: number;
}

export interface ViewHandlers {
  onFiltersChange: (filters: ArtworkFilters) => void;
  onPublish: () => void;
  onCardAction: (action: CardAction, id: number) => void;
  onEditSubmit: (id: number, patch: ArtworkPatch) => void;
  onDeleteConfirm: (id: number) => void;
  onLightboxAction: (action: 'download' | 'edit', id: number) => void;
}

const dateShort = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });
const dateLong = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

const TITLE_PREFIXES = [
  'Deriva',
  'Cartografía',
  'Estructura',
  'Canto',
  'Umbral',
  'Fragmento',
  'Sinfonía',
  'Geometría',
  'Vértigo',
  'Marea',
  'Eco',
  'Máquina',
  'Constelación',
  'Materia',
];

const TITLE_SUFFIXES = [
  'orbital',
  'del vacío',
  'luminosa',
  'suspendida',
  'en órbita',
  'de cristal',
  'latente',
  'en reposo',
  'número siete',
  'de sombra',
  'sin gravedad',
  'en azul',
  'imperfecta',
  'del alba',
];

const TOAST_ICONS: Record<ToastVariant, string> = {
  success: 'i-check',
  error: 'i-warning',
  info: 'i-spark',
};

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return found;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function seedSpec(artwork: Artwork): ArtworkSpec {
  return {
    algorithm: artwork.algorithm,
    palette: artwork.palette,
    seed: artwork.seed,
    complexity: artwork.complexity,
  };
}

function formatTime(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 KB';
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }
  return `${(kilobytes / 1024).toFixed(2)} MB`;
}

export class GalleryView {
  private handlers: ViewHandlers | null = null;

  private readonly galleryGrid = element<HTMLElement>('#gallery-grid');
  private readonly emptyState = element<HTMLElement>('#empty-state');
  private readonly emptyTitle = element<HTMLElement>('#empty-title');
  private readonly emptyCopy = element<HTMLElement>('#empty-copy');
  private readonly emptyCta = element<HTMLElement>('#empty-cta');
  private readonly emptyReset = element<HTMLButtonElement>('#empty-reset');
  private readonly resultsBar = element<HTMLElement>('#results-bar');
  private readonly resultsText = element<HTMLElement>('#results-text');
  private readonly resultsReset = element<HTMLButtonElement>('#results-reset');
  private readonly countPill = element<HTMLElement>('#gallery-count');
  private readonly heroCount = element<HTMLElement>('#stat-artworks');

  private readonly searchInput = element<HTMLInputElement>('#search-input');
  private readonly searchClear = element<HTMLButtonElement>('#search-clear');
  private readonly paletteFilters = element<HTMLElement>('#palette-filters');
  private readonly algorithmFilters = element<HTMLElement>('#algorithm-filters');

  private readonly studioCanvas = element<HTMLCanvasElement>('#studio-canvas');
  private readonly algorithmSelect = element<HTMLSelectElement>('#algorithm-select');
  private readonly paletteSelect = element<HTMLSelectElement>('#palette-select');
  private readonly complexityRange = element<HTMLInputElement>('#complexity-range');
  private readonly complexityOutput = element<HTMLOutputElement>('#complexity-value');
  private readonly seedDisplay = element<HTMLElement>('#seed-value');
  private readonly previewSeed = element<HTMLElement>('#preview-seed');
  private readonly previewAlgorithm = element<HTMLElement>('#preview-algorithm');
  private readonly previewPalette = element<HTMLElement>('#preview-palette');
  private readonly previewComplexity = element<HTMLElement>('#preview-complexity');
  private readonly titleInput = element<HTMLInputElement>('#title-input');
  private readonly artistInput = element<HTMLInputElement>('#artist-input');
  private readonly studioHint = element<HTMLElement>('#studio-hint');
  private readonly publishButton = element<HTMLButtonElement>('#publish-btn');
  private readonly publishLabel = element<HTMLElement>('#publish-label');

  private readonly editModal = element<HTMLElement>('#edit-modal');
  private readonly editForm = element<HTMLFormElement>('#edit-form');
  private readonly editId = element<HTMLInputElement>('#edit-id');
  private readonly editTitle = element<HTMLInputElement>('#edit-title');
  private readonly editArtist = element<HTMLInputElement>('#edit-artist');
  private readonly editPalette = element<HTMLSelectElement>('#edit-palette');
  private readonly editArtifact = element<HTMLElement>('#edit-artifact');
  private readonly editHint = element<HTMLElement>('#edit-hint');

  private readonly lightbox = element<HTMLElement>('#lightbox');
  private readonly lightboxCanvas = element<HTMLCanvasElement>('#lightbox-canvas');
  private readonly lightboxTitle = element<HTMLElement>('#lightbox-title');
  private readonly lightboxArtist = element<HTMLElement>('#lightbox-artist');
  private readonly lightboxAlgorithm = element<HTMLElement>('#lightbox-algorithm');
  private readonly lightboxPalette = element<HTMLElement>('#lightbox-palette');
  private readonly lightboxSeed = element<HTMLElement>('#lightbox-seed');
  private readonly lightboxSeedChip = element<HTMLElement>('#lightbox-seed-chip');
  private readonly lightboxComplexity = element<HTMLElement>('#lightbox-complexity');
  private readonly lightboxDate = element<HTMLElement>('#lightbox-date');
  private readonly lightboxId = element<HTMLElement>('#lightbox-id');
  private readonly lightboxBar = element<HTMLElement>('#lightbox-complexity-bar');

  private readonly deleteModal = element<HTMLElement>('#delete-modal');
  private readonly deleteArtworkTitle = element<HTMLElement>('#delete-artwork-title');

  private readonly sqlDrawer = element<HTMLElement>('#sql-drawer');
  private readonly sqlToggle = element<HTMLButtonElement>('#sql-toggle');
  private readonly sqlLog = element<HTMLElement>('#sql-log');
  private readonly sqlCount = element<HTMLElement>('#sql-count');
  private readonly sqlPersisted = element<HTMLElement>('#sql-persisted');
  private readonly toastContainer = element<HTMLElement>('#toast-container');

  private readonly dbStatusText = element<HTMLElement>('#db-status-text');
  private readonly dbStatusDot = element<HTMLElement>('#db-status-dot');
  private readonly heroStatusDot = element<HTMLElement>('#hero-status-dot');
  private readonly heroNoteText = element<HTMLElement>('#hero-note-text');
  private readonly galleryDbDot = element<HTMLElement>('#gallery-db-dot');

  private currentSeed = createRandomSeed();
  private activePalette: Palette | null = null;
  private activeAlgorithm: Algorithm | null = null;
  private searchQuery = '';
  private searchTimer = 0;
  private previewTimer = 0;
  private pendingDeleteId: number | null = null;
  private lightboxArtwork: Artwork | null = null;
  private lastFocused: HTMLElement | null = null;

  constructor() {
    this.populateStudioOptions();
    this.populateEditOptions();
    this.renderFilterPills();
    this.updateRangeProgress();
    this.bindUi();
    this.syncPreview();

    const year = document.querySelector('#footer-year');
    if (year) {
      year.textContent = String(new Date().getFullYear());
    }
  }

  bindHandlers(handlers: ViewHandlers): void {
    this.handlers = handlers;
  }

  readStudio(): StudioInput {
    const algorithmValue = this.algorithmSelect.value;
    const paletteValue = this.paletteSelect.value;
    const algorithm = (ALGORITHMS as readonly string[]).includes(algorithmValue)
      ? (algorithmValue as Algorithm)
      : ALGORITHMS[0];
    const palette = (PALETTES as readonly string[]).includes(paletteValue)
      ? (paletteValue as Palette)
      : PALETTES[0];

    return {
      title: this.titleInput.value,
      artist: this.artistInput.value,
      algorithm,
      palette,
      seed: this.currentSeed,
      complexity: Number(this.complexityRange.value),
    };
  }

  getFilters(): ArtworkFilters {
    return {
      query: this.searchQuery.trim() || undefined,
      palette: this.activePalette,
      algorithm: this.activeAlgorithm,
    };
  }

  syncPreview(): void {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => this.drawPreview(), 36);
  }

  renderGallery(artworks: Artwork[], total: number): void {
    this.updateCounts(total);
    this.updateResultsBar(artworks.length, total);

    if (artworks.length === 0) {
      this.galleryGrid.hidden = true;
      this.galleryGrid.innerHTML = '';
      this.renderEmptyState(total);
      return;
    }

    this.emptyState.hidden = true;
    this.galleryGrid.hidden = false;
    this.galleryGrid.innerHTML = artworks.map((artwork) => this.cardTemplate(artwork)).join('');

    const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));
    for (const canvas of this.galleryGrid.querySelectorAll<HTMLCanvasElement>('canvas[data-artwork-id]')) {
      const id = Number(canvas.dataset.artworkId);
      const artwork = byId.get(id);
      if (artwork) {
        renderArtwork(canvas, seedSpec(artwork), 820);
      }
    }
  }

  updateCounts(total: number): void {
    this.countPill.textContent = `${total} ${total === 1 ? 'obra' : 'obras'}`;
    this.heroCount.textContent = String(total).padStart(2, '0');
    this.heroNoteText.textContent = `${total} ${total === 1 ? 'pieza' : 'piezas'} en el archivo local`;
  }

  setPersistenceState(state: PersistenceState): void {
    if (!state.ok) {
      this.sqlPersisted.textContent = 'Persistencia con errores';
      return;
    }
    this.sqlPersisted.textContent = state.savedAt
      ? `Guardado ${formatTime(state.savedAt)} · ${formatBytes(state.bytes)}`
      : 'Persistencia lista';
  }

  renderSqlLog(entries: readonly SqlLogEntry[]): void {
    this.sqlCount.textContent = `${entries.length} ${entries.length === 1 ? 'sentencia' : 'sentencias'}`;

    if (entries.length === 0) {
      this.sqlLog.innerHTML = '<p class="sql-empty">Aún no hay consultas registradas.</p>';
      return;
    }

    const newestFirst = [...entries].reverse();
    this.sqlLog.innerHTML = newestFirst
      .map((entry) => {
        const params =
          entry.params.length > 0
            ? `<p class="sql-params"><span>params</span> ${escapeHtml(JSON.stringify(entry.params))}</p>`
            : '';
        const metaParts = [`${formatTime(entry.at)}`, `${entry.durationMs} ms`];
        if (typeof entry.rows === 'number') {
          metaParts.push(`${entry.rows} fila${entry.rows === 1 ? '' : 's'}`);
        }
        if (typeof entry.changes === 'number' && entry.changes > 0) {
          metaParts.push(`${entry.changes} cambio${entry.changes === 1 ? '' : 's'}`);
        }
        const source = entry.source ? `<span class="sql-source">${entry.source}</span>` : '';

        return `
          <article class="sql-entry">
            <header class="sql-entry-head">
              <span class="sql-op sql-op-${entry.operation.toLowerCase()}">${entry.operation}</span>
              <span class="sql-meta">${escapeHtml(metaParts.join(' · '))}</span>
              ${source}
            </header>
            <code class="sql-code">${escapeHtml(entry.sql)}</code>
            ${params}
          </article>
        `;
      })
      .join('');
    this.sqlLog.scrollTop = 0;
  }

  appendSqlEntry(entry: SqlLogEntry): void {
    const wasEmpty = this.sqlLog.querySelector('.sql-empty') !== null;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <article class="sql-entry is-new">
        <header class="sql-entry-head">
          <span class="sql-op sql-op-${entry.operation.toLowerCase()}">${entry.operation}</span>
          <span class="sql-meta">${escapeHtml(`${formatTime(entry.at)} · ${entry.durationMs} ms`)}</span>
        </header>
        <code class="sql-code">${escapeHtml(entry.sql)}</code>
        ${
          entry.params.length > 0
            ? `<p class="sql-params"><span>params</span> ${escapeHtml(JSON.stringify(entry.params))}</p>`
            : ''
        }
      </article>
    `;
    const node = wrapper.firstElementChild;
    if (!node) {
      return;
    }

    if (wasEmpty) {
      this.sqlLog.innerHTML = '';
    }
    this.sqlLog.prepend(node);

    while (this.sqlLog.children.length > 60) {
      this.sqlLog.lastElementChild?.remove();
    }

    const count = this.sqlLog.querySelectorAll('.sql-entry').length;
    this.sqlCount.textContent = `${count} ${count === 1 ? 'sentencia' : 'sentencias'}`;
  }

  setDbStatus(status: 'loading' | 'ready' | 'error', detail = ''): void {
    const dotClass = status === 'ready' ? 'is-ready' : status === 'error' ? 'is-error' : 'is-loading';
    this.dbStatusDot.className = `status-dot ${dotClass}`;
    this.heroStatusDot.className = `status-dot ${dotClass}`;
    this.galleryDbDot.className = `status-dot ${dotClass}`;

    if (status === 'ready') {
      this.dbStatusText.textContent = 'SQLite persistente activo';
      this.heroNoteText.textContent = detail || 'Archivo local listo';
    } else if (status === 'error') {
      this.dbStatusText.textContent = 'SQLite no disponible';
      this.heroNoteText.textContent = detail || 'No se pudo abrir la base local';
    } else {
      this.dbStatusText.textContent = 'Conectando SQLite…';
      this.heroNoteText.textContent = detail || 'Inicializando el archivo local…';
    }
  }

  setPublishing(publishing: boolean): void {
    this.publishButton.disabled = publishing;
    this.publishButton.classList.toggle('is-loading', publishing);
    this.publishLabel.textContent = publishing ? 'Publicando…' : 'Publicar en galería';
  }

  setStudioError(message: string): void {
    this.studioHint.textContent = message;
    this.studioHint.classList.toggle('is-visible', message.length > 0);
    if (message) {
      this.titleInput.setAttribute('aria-invalid', this.titleInput.value.trim() ? 'false' : 'true');
    } else {
      this.titleInput.removeAttribute('aria-invalid');
    }
  }

  focusTitle(): void {
    this.titleInput.focus();
    this.titleInput.select();
  }

  focusArtist(): void {
    this.artistInput.focus();
    this.artistInput.select();
  }

  prepareNextArtwork(): void {
    this.titleInput.value = '';
    this.currentSeed = createRandomSeed();
    this.setStudioError('');
    this.syncPreview();
  }

  showToast(message: string, variant: ToastVariant = 'success'): void {
    while (this.toastContainer.children.length >= 4) {
      this.toastContainer.firstElementChild?.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">
        <svg class="icon" aria-hidden="true"><use href="#${TOAST_ICONS[variant]}"></use></svg>
      </span>
      <p class="toast-message"></p>
      <button type="button" class="toast-close" aria-label="Cerrar notificación">
        <svg class="icon icon-xs" aria-hidden="true"><use href="#i-close"></use></svg>
      </button>
    `;
    const text = toast.querySelector<HTMLElement>('.toast-message');
    if (text) {
      text.textContent = message;
    }

    this.toastContainer.appendChild(toast);

    const dismiss = () => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 260);
    };

    toast.querySelector<HTMLButtonElement>('.toast-close')?.addEventListener('click', dismiss, { once: true });
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.setTimeout(() => {
      if (toast.isConnected) {
        dismiss();
      }
    }, 4200);
  }

  openEdit(artwork: Artwork): void {
    this.closeAllModals();
    this.editId.value = String(artwork.id);
    this.editTitle.value = artwork.title;
    this.editArtist.value = artwork.artist;
    this.editPalette.value = artwork.palette;
    this.editArtifact.textContent = `${artwork.algorithm} · ${seedToHex(artwork.seed)} · ${artwork.complexity}%`;
    this.editHint.textContent = '';
    this.editHint.classList.remove('is-visible');
    this.openModal(this.editModal);
    this.focusWhenVisible(this.editTitle, true);
  }

  closeEdit(): void {
    this.closeModal(this.editModal);
  }

  showEditError(message: string): void {
    this.editHint.textContent = message;
    this.editHint.classList.toggle('is-visible', message.length > 0);
  }

  askDelete(artwork: Artwork): void {
    this.pendingDeleteId = artwork.id;
    this.deleteArtworkTitle.textContent = artwork.title;
    this.openModal(this.deleteModal);
    this.focusWhenVisible(element<HTMLButtonElement>('#delete-cancel'));
  }

  closeDelete(): void {
    this.pendingDeleteId = null;
    this.closeModal(this.deleteModal);
  }

  openLightbox(artwork: Artwork): void {
    this.lightboxArtwork = artwork;
    this.lightboxTitle.textContent = artwork.title;
    this.lightboxArtist.textContent = artwork.artist;
    this.lightboxAlgorithm.textContent = artwork.algorithm;
    this.lightboxPalette.textContent = artwork.palette;
    this.lightboxSeed.textContent = `${seedToHex(artwork.seed)} · ${artwork.seed}`;
    this.lightboxSeedChip.textContent = seedToHex(artwork.seed);
    this.lightboxComplexity.textContent = `${artwork.complexity} / 100`;
    this.lightboxDate.textContent = dateLong.format(new Date(artwork.createdAt));
    this.lightboxId.textContent = `#${String(artwork.id).padStart(3, '0')} · SQLite`;
    this.lightboxBar.style.width = `${artwork.complexity}%`;
    renderArtwork(this.lightboxCanvas, seedSpec(artwork), 1600);
    this.openModal(this.lightbox);
    this.focusWhenVisible(element<HTMLButtonElement>('#lightbox-close'));
  }

  closeLightbox(): void {
    this.lightboxArtwork = null;
    this.closeModal(this.lightbox);
  }

  closeAllModals(): void {
    for (const modal of document.querySelectorAll<HTMLElement>('.modal.is-open')) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');
  }

  closeModal(modal: HTMLElement): void {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open')) {
      document.body.classList.remove('modal-open');
      if (this.lastFocused?.isConnected) {
        this.lastFocused.focus({ preventScroll: true });
      }
    }
  }

  toggleSqlDrawer(force?: boolean): void {
    const shouldOpen = force ?? !this.sqlDrawer.classList.contains('is-open');
    this.sqlDrawer.classList.toggle('is-open', shouldOpen);
    this.sqlDrawer.setAttribute('aria-hidden', String(!shouldOpen));
    this.sqlToggle.setAttribute('aria-expanded', String(shouldOpen));
    this.sqlToggle.classList.toggle('is-active', shouldOpen);
    if (shouldOpen) {
      this.sqlLog.scrollTop = 0;
      element<HTMLButtonElement>('#sql-close').focus({ preventScroll: true });
    } else if (document.activeElement === document.querySelector('#sql-close')) {
      this.sqlToggle.focus({ preventScroll: true });
    }
  }

  hideBoot(): void {
    document.body.classList.remove('is-booting');
    const overlay = document.querySelector<HTMLElement>('#boot-overlay');
    if (!overlay) {
      return;
    }
    overlay.classList.add('is-hidden');
    window.setTimeout(() => overlay.setAttribute('aria-hidden', 'true'), 500);
  }

  private updateResultsBar(visibleCount: number, total: number): void {
    const filtered = Boolean(this.activePalette || this.activeAlgorithm || this.searchQuery.trim());
    this.resultsBar.hidden = !filtered;
    if (!filtered) {
      return;
    }
    const noun = visibleCount === 1 ? 'obra' : 'obras';
    this.resultsText.textContent = `${visibleCount} ${noun} de ${total} coinciden con el filtro activo`;
  }

  private renderEmptyState(total: number): void {
    const filtered = Boolean(this.activePalette || this.activeAlgorithm || this.searchQuery.trim());
    this.emptyState.hidden = false;

    if (total === 0 || !filtered) {
      this.emptyTitle.textContent = 'La galería espera su primera obra';
      this.emptyCopy.textContent =
        'Compón una pieza en el estudio, dale un título y publícala. Quedará guardada en tu archivo SQLite.';
      this.emptyCta.hidden = false;
      this.emptyReset.hidden = true;
    } else {
      this.emptyTitle.textContent = 'Ninguna obra coincide';
      this.emptyCopy.textContent =
        'Prueba con otro término o limpia los filtros para volver a recorrer la colección completa.';
      this.emptyCta.hidden = true;
      this.emptyReset.hidden = false;
    }
  }

  renderFatal(message: string): void {
    this.galleryGrid.hidden = true;
    this.galleryGrid.innerHTML = '';
    this.emptyState.hidden = false;
    this.emptyTitle.textContent = 'No se pudo abrir el archivo';
    this.emptyCopy.textContent = message;
    this.emptyCta.hidden = true;
    this.emptyReset.hidden = true;
    this.resultsBar.hidden = true;
    this.setDbStatus('error', message);
  }

  private cardTemplate(artwork: Artwork): string {
    const paletteDefinition = PALETTE_DEFINITIONS[artwork.palette];
    const title = escapeHtml(artwork.title);
    const artist = escapeHtml(artwork.artist);
    const palette = escapeHtml(artwork.palette);
    const algorithm = escapeHtml(artwork.algorithm);
    const hex = seedToHex(artwork.seed);
    const swatch = paletteDefinition?.swatch ?? '#a1a1aa';

    return `
      <article class="artwork-card" style="--card-accent: ${swatch}">
        <div class="card-art">
          <canvas class="artwork-canvas" data-artwork-id="${artwork.id}" width="820" height="820" aria-hidden="true"></canvas>
          <button type="button" class="card-open" data-action="view" data-id="${artwork.id}" aria-label="Ver la ficha de ${title}"></button>
          <span class="card-seed">${hex}</span>
          <div class="card-actions">
            <button type="button" class="action-btn" data-action="view" data-id="${artwork.id}" title="Vista inmersiva" aria-label="Abrir ${title} en vista inmersiva">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#i-expand"></use></svg>
            </button>
            <button type="button" class="action-btn" data-action="download" data-id="${artwork.id}" title="Exportar PNG" aria-label="Exportar ${title} a PNG">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#i-download"></use></svg>
            </button>
            <button type="button" class="action-btn" data-action="edit" data-id="${artwork.id}" title="Editar ficha" aria-label="Editar la ficha de ${title}">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#i-edit"></use></svg>
            </button>
            <button type="button" class="action-btn action-btn-danger" data-action="delete" data-id="${artwork.id}" title="Eliminar obra" aria-label="Eliminar ${title}">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#i-trash"></use></svg>
            </button>
          </div>
          <span class="card-hint" aria-hidden="true">Ver ficha <svg class="icon icon-xs" aria-hidden="true"><use href="#i-arrow"></use></svg></span>
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title">${title}</h3>
            <span class="complexity-chip" title="Complejidad">${artwork.complexity}</span>
          </div>
          <div class="card-artist">
            <span class="artist-avatar" aria-hidden="true">${escapeHtml(initials(artwork.artist))}</span>
            <span class="artist-name">${artist}</span>
          </div>
          <div class="card-meta">
            <span class="chip-algorithm" title="${escapeHtml(ALGORITHM_COPY[artwork.algorithm])}">${algorithm}</span>
            <span class="palette-tag">
              <span class="palette-swatch" style="--swatch: ${swatch}" aria-hidden="true"></span>
              ${palette}
            </span>
          </div>
          <div class="card-foot">
            <span>${escapeHtml(dateShort.format(new Date(artwork.createdAt)))}</span>
            <span class="mono">REG · ${String(artwork.id).padStart(3, '0')}</span>
          </div>
        </div>
      </article>
    `;
  }

  private populateStudioOptions(): void {
    this.algorithmSelect.innerHTML = ALGORITHMS.map(
      (algorithm) => `<option value="${escapeHtml(algorithm)}">${escapeHtml(algorithm)}</option>`,
    ).join('');
    this.paletteSelect.innerHTML = PALETTES.map(
      (palette) => `<option value="${escapeHtml(palette)}">${escapeHtml(palette)}</option>`,
    ).join('');
    this.algorithmSelect.value = ALGORITHMS[0];
    this.paletteSelect.value = PALETTES[0];
  }

  private populateEditOptions(): void {
    this.editPalette.innerHTML = PALETTES.map(
      (palette) => `<option value="${escapeHtml(palette)}">${escapeHtml(palette)}</option>`,
    ).join('');
    this.editPalette.value = PALETTES[0];
  }

  private renderFilterPills(): void {
    const allPalettes = `<button type="button" class="pill is-active" data-palette="" aria-pressed="true">Todas</button>`;
    const palettePills = PALETTES.map((palette) => {
      const swatch = PALETTE_DEFINITIONS[palette]?.swatch ?? '#a1a1aa';
      return `<button type="button" class="pill" data-palette="${escapeHtml(palette)}" aria-pressed="false">
        <span class="pill-swatch" style="--swatch: ${swatch}" aria-hidden="true"></span>
        ${escapeHtml(palette)}
      </button>`;
    }).join('');
    this.paletteFilters.innerHTML = allPalettes + palettePills;

    const allAlgorithms = `<button type="button" class="pill is-active" data-algorithm="" aria-pressed="true">Todos</button>`;
    const algorithmPills = ALGORITHMS.map(
      (algorithm) =>
        `<button type="button" class="pill" data-algorithm="${escapeHtml(algorithm)}" aria-pressed="false">${escapeHtml(algorithm)}</button>`,
    ).join('');
    this.algorithmFilters.innerHTML = allAlgorithms + algorithmPills;
  }

  private updatePillStates(): void {
    for (const pill of this.paletteFilters.querySelectorAll<HTMLButtonElement>('[data-palette]')) {
      const active = (pill.dataset.palette ?? '') === (this.activePalette ?? '');
      pill.classList.toggle('is-active', active);
      pill.setAttribute('aria-pressed', String(active));
    }
    for (const pill of this.algorithmFilters.querySelectorAll<HTMLButtonElement>('[data-algorithm]')) {
      const active = (pill.dataset.algorithm ?? '') === (this.activeAlgorithm ?? '');
      pill.classList.toggle('is-active', active);
      pill.setAttribute('aria-pressed', String(active));
    }
  }

  private resetFilters(): void {
    this.activePalette = null;
    this.activeAlgorithm = null;
    this.searchQuery = '';
    this.searchInput.value = '';
    this.searchClear.hidden = true;
    this.updatePillStates();
    this.handlers?.onFiltersChange(this.getFilters());
  }

  private computeFilters(): void {
    this.handlers?.onFiltersChange(this.getFilters());
  }

  private updateRangeProgress(): void {
    const min = Number(this.complexityRange.min);
    const max = Number(this.complexityRange.max);
    const value = Number(this.complexityRange.value);
    const progress = ((value - min) / (max - min)) * 100;
    this.complexityRange.style.setProperty('--range-progress', `${progress}%`);
    this.complexityOutput.textContent = String(value);
  }

  private drawPreview(): void {
    const algorithm = this.readAlgorithm();
    const palette = this.readPalette();
    const complexity = Number(this.complexityRange.value);

    renderArtwork(
      this.studioCanvas,
      {
        algorithm,
        palette,
        seed: this.currentSeed,
        complexity,
      },
      1100,
    );

    this.previewAlgorithm.textContent = algorithm;
    this.previewPalette.textContent = palette;
    this.previewComplexity.textContent = `Complejidad ${complexity}`;
    this.seedDisplay.textContent = seedToHex(this.currentSeed);
    this.previewSeed.textContent = seedToHex(this.currentSeed);
  }

  private readAlgorithm(): Algorithm {
    const value = this.algorithmSelect.value;
    return (ALGORITHMS as readonly string[]).includes(value) ? (value as Algorithm) : ALGORITHMS[0];
  }

  private readPalette(): Palette {
    const value = this.paletteSelect.value;
    return (PALETTES as readonly string[]).includes(value) ? (value as Palette) : PALETTES[0];
  }

  private randomizeSeed(): void {
    this.currentSeed = createRandomSeed();
    this.setStudioError('');
    this.drawPreview();
    if (!document.body.classList.contains('is-booting')) {
      this.showToast(`Nueva semilla ${seedToHex(this.currentSeed)}`, 'info');
    }
  }

  private surprise(): void {
    this.algorithmSelect.value = ALGORITHMS[Math.floor(Math.random() * ALGORITHMS.length)] ?? ALGORITHMS[0];
    this.paletteSelect.value = PALETTES[Math.floor(Math.random() * PALETTES.length)] ?? PALETTES[0];
    this.complexityRange.value = String(28 + Math.floor(Math.random() * 66));
    this.currentSeed = createRandomSeed();
    this.updateRangeProgress();
    this.setStudioError('');
    this.drawPreview();
    this.titleInput.value = this.suggestTitle();
    this.titleInput.classList.add('is-suggested');
    window.setTimeout(() => this.titleInput.classList.remove('is-suggested'), 1200);
    this.showToast('Composición aleatoria servida. Ajústala a tu gusto.', 'info');
  }

  private suggestTitle(): string {
    const prefix = TITLE_PREFIXES[Math.floor(Math.random() * TITLE_PREFIXES.length)] ?? 'Deriva';
    const suffix = TITLE_SUFFIXES[Math.floor(Math.random() * TITLE_SUFFIXES.length)] ?? 'orbital';
    return `${prefix} ${suffix}`;
  }

  private openModal(modal: HTMLElement): void {
    const active = document.activeElement;
    this.lastFocused =
      active instanceof HTMLElement && !active.closest('.modal') ? active : null;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  private focusWhenVisible(target: HTMLElement, select = false): void {
    const focusTarget = () => {
      if (!target.isConnected) {
        return;
      }
      target.focus({ preventScroll: true });
      if (select && target instanceof HTMLInputElement) {
        target.select();
      }
    };

    focusTarget();
    requestAnimationFrame(() => {
      requestAnimationFrame(focusTarget);
    });
  }

  private trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const modal = document.querySelector<HTMLElement>('.modal.is-open');
    if (!modal) {
      return;
    }
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((node) => node.offsetParent !== null || node === document.activeElement);

    if (focusables.length === 0) {
      return;
    }

    const first = focusables[0] as HTMLElement;
    const last = focusables[focusables.length - 1] as HTMLElement;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private bindUi(): void {
    this.algorithmSelect.addEventListener('change', () => this.syncPreview());
    this.paletteSelect.addEventListener('change', () => this.syncPreview());

    this.complexityRange.addEventListener('input', () => {
      this.updateRangeProgress();
      this.syncPreview();
    });

    element<HTMLButtonElement>('#randomize-seed').addEventListener('click', () => this.randomizeSeed());
    element<HTMLButtonElement>('#surprise-btn').addEventListener('click', () => this.surprise());

    this.titleInput.addEventListener('input', () => {
      if (this.titleInput.value.trim()) {
        this.setStudioError('');
      }
    });

    element<HTMLFormElement>('#studio-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.handlers?.onPublish();
    });

    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value;
      this.searchClear.hidden = this.searchQuery.length === 0;
      window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => this.computeFilters(), 160);
    });

    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.searchInput.value = '';
        this.searchQuery = '';
        this.searchClear.hidden = true;
        this.computeFilters();
      }
    });

    this.searchClear.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.searchClear.hidden = true;
      this.searchInput.focus();
      this.computeFilters();
    });

    this.paletteFilters.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-palette]') : null;
      if (!target) {
        return;
      }
      const value = target.dataset.palette ?? '';
      const next = value === '' ? null : (value as Palette);
      this.activePalette = next === this.activePalette ? null : next;
      this.updatePillStates();
      this.computeFilters();
    });

    this.algorithmFilters.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-algorithm]') : null;
      if (!target) {
        return;
      }
      const value = target.dataset.algorithm ?? '';
      const next = value === '' ? null : (value as Algorithm);
      this.activeAlgorithm = next === this.activeAlgorithm ? null : next;
      this.updatePillStates();
      this.computeFilters();
    });

    this.resultsReset.addEventListener('click', () => this.resetFilters());
    this.emptyReset.addEventListener('click', () => this.resetFilters());

    this.galleryGrid.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
      if (!target) {
        return;
      }
      const action = target.dataset.action as CardAction | undefined;
      const id = Number(target.dataset.id ?? target.closest<HTMLElement>('[data-id]')?.dataset.id);
      if (!action || !Number.isFinite(id)) {
        return;
      }
      this.handlers?.onCardAction(action, id);
    });

    const closeLightbox = element<HTMLButtonElement>('#lightbox-close');
    closeLightbox.addEventListener('click', () => this.closeLightbox());

    element<HTMLButtonElement>('#lightbox-download').addEventListener('click', () => {
      if (this.lightboxArtwork) {
        this.handlers?.onLightboxAction('download', this.lightboxArtwork.id);
      }
    });

    element<HTMLButtonElement>('#lightbox-edit').addEventListener('click', () => {
      if (this.lightboxArtwork) {
        this.handlers?.onLightboxAction('edit', this.lightboxArtwork.id);
      }
    });

    element<HTMLButtonElement>('#edit-close').addEventListener('click', () => this.closeEdit());
    element<HTMLButtonElement>('#edit-cancel').addEventListener('click', () => this.closeEdit());

    this.editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const id = Number(this.editId.value);
      if (!Number.isFinite(id)) {
        return;
      }
      this.handlers?.onEditSubmit(id, {
        title: this.editTitle.value,
        artist: this.editArtist.value,
        palette: this.editPalette.value as Palette,
      });
    });

    element<HTMLButtonElement>('#delete-cancel').addEventListener('click', () => this.closeDelete());
    element<HTMLButtonElement>('#delete-confirm').addEventListener('click', () => {
      if (this.pendingDeleteId !== null) {
        this.handlers?.onDeleteConfirm(this.pendingDeleteId);
      }
    });

    for (const backdrop of document.querySelectorAll<HTMLElement>('[data-close-modal]')) {
      backdrop.addEventListener('click', () => {
        const id = backdrop.dataset.closeModal;
        const modal = id ? document.getElementById(id) : null;
        if (!modal) {
          return;
        }
        if (modal === this.editModal) {
          this.closeEdit();
        } else if (modal === this.deleteModal) {
          this.closeDelete();
        } else if (modal === this.lightbox) {
          this.closeLightbox();
        }
      });
    }

    this.sqlToggle.addEventListener('click', () => this.toggleSqlDrawer());
    element<HTMLButtonElement>('#sql-close').addEventListener('click', () => this.toggleSqlDrawer(false));

    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-focus-search]')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        document.querySelector('#galeria')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => this.searchInput.focus({ preventScroll: true }), 380);
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const openModal = document.querySelector<HTMLElement>('.modal.is-open');
        if (openModal) {
          if (openModal === this.lightbox) {
            this.closeLightbox();
          } else if (openModal === this.editModal) {
            this.closeEdit();
          } else if (openModal === this.deleteModal) {
            this.closeDelete();
          }
          return;
        }
        if (this.sqlDrawer.classList.contains('is-open')) {
          this.toggleSqlDrawer(false);
          this.sqlToggle.focus();
        }
      }

      if (
        event.key === '/' &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLSelectElement)
      ) {
        event.preventDefault();
        this.searchInput.focus();
        this.searchInput.select();
      }

      this.trapFocus(event);
    });
  }
}
