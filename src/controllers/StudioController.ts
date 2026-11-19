import {
  ArtworkModel,
  type Artwork,
  type ArtworkFilters,
  type ArtworkPatch,
} from '../models/ArtworkModel';
import {
  getPersistenceState,
  getQueryLog,
  initDatabase,
  subscribeToPersistence,
  subscribeToQueryLog,
} from '../db/database';
import { downloadArtworkPng, type ArtworkSpec } from '../utils/generative';
import type { CardAction, GalleryView } from '../views/GalleryView';

function specOf(artwork: Artwork): ArtworkSpec {
  return {
    algorithm: artwork.algorithm,
    palette: artwork.palette,
    seed: artwork.seed,
    complexity: artwork.complexity,
  };
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

/**
 * Controlador principal: orquesta el modelo SQLite, la generación procedural
 * y los eventos de la interfaz. La vista nunca habla con la base de datos.
 */
export class StudioController {
  private filters: ArtworkFilters = {};
  private persistenceWarningShown = false;

  constructor(private readonly view: GalleryView) {
    this.view.bindHandlers({
      onFiltersChange: (filters) => this.handleFilters(filters),
      onPublish: () => this.handlePublish(),
      onCardAction: (action, id) => this.handleCardAction(action, id),
      onEditSubmit: (id, patch) => this.handleEditSubmit(id, patch),
      onDeleteConfirm: (id) => this.handleDeleteConfirm(id),
      onLightboxAction: (action, id) => this.handleLightboxAction(action, id),
    });
  }

  async init(): Promise<void> {
    this.view.setDbStatus('loading');

    await initDatabase();

    const total = ArtworkModel.count();
    const artworks = ArtworkModel.list(this.filters);

    this.view.renderGallery(artworks, total);
    this.view.renderSqlLog(getQueryLog());
    this.view.setPersistenceState(getPersistenceState());
    this.view.setDbStatus(
      'ready',
      `${total} ${total === 1 ? 'pieza' : 'piezas'} · archivo local persistente`,
    );

    subscribeToQueryLog((entry) => {
      this.view.appendSqlEntry(entry);
      this.view.setPersistenceState(getPersistenceState());
    });

    subscribeToPersistence((state) => {
      this.view.setPersistenceState(state);
      if (!state.ok && !this.persistenceWarningShown) {
        this.persistenceWarningShown = true;
        this.view.showToast(
          'La base funciona en memoria, pero el navegador no permitió persistirla en localStorage.',
          'error',
        );
      }
    });

    if (!getPersistenceState().ok) {
      this.persistenceWarningShown = true;
      this.view.showToast('No se pudo persistir la base de datos en localStorage.', 'error');
    }

    this.view.hideBoot();
  }

  private handleFilters(filters: ArtworkFilters): void {
    this.filters = filters;
    this.refreshGallery();
  }

  private refreshGallery(): void {
    const total = ArtworkModel.count();
    const artworks = ArtworkModel.list(this.filters);
    this.view.renderGallery(artworks, total);
  }

  private handlePublish(): void {
    const input = this.view.readStudio();

    if (!input.title.trim()) {
      this.view.setStudioError('La obra necesita un título para entrar al archivo.');
      this.view.focusTitle();
      return;
    }

    if (!input.artist.trim()) {
      this.view.setStudioError('Firma tu obra: escribe el nombre del autor.');
      this.view.focusArtist();
      return;
    }

    this.view.setPublishing(true);
    this.view.setStudioError('');

    try {
      const artwork = ArtworkModel.create({
        title: input.title,
        artist: input.artist,
        algorithm: input.algorithm,
        palette: input.palette,
        seed: input.seed,
        complexity: input.complexity,
      });

      this.refreshGallery();
      this.view.prepareNextArtwork();
      this.view.focusTitle();
      this.view.showToast(`«${artwork.title}» ya forma parte de la galería.`, 'success');
    } catch (error) {
      const message = messageOf(error, 'No se pudo guardar la obra en SQLite.');
      this.view.setStudioError(message);
      this.view.showToast(message, 'error');
    } finally {
      this.view.setPublishing(false);
    }
  }

  private handleCardAction(action: CardAction, id: number): void {
    const artwork = ArtworkModel.findById(id);

    if (!artwork) {
      this.refreshGallery();
      this.view.showToast('La obra ya no existe en el archivo. Actualizando la galería…', 'info');
      return;
    }

    switch (action) {
      case 'view':
        this.view.openLightbox(artwork);
        break;
      case 'download':
        this.exportPng(artwork);
        break;
      case 'edit':
        this.view.openEdit(artwork);
        break;
      case 'delete':
        this.view.askDelete(artwork);
        break;
      default:
        break;
    }
  }

  private handleEditSubmit(id: number, patch: ArtworkPatch): void {
    if (!patch.title.trim()) {
      this.view.showEditError('El título no puede quedar vacío.');
      return;
    }
    if (!patch.artist.trim()) {
      this.view.showEditError('El autor no puede quedar vacío.');
      return;
    }

    try {
      const updated = ArtworkModel.update(id, patch);
      this.view.closeEdit();
      this.refreshGallery();
      this.view.showToast(`Ficha actualizada: «${updated.title}».`, 'success');
    } catch (error) {
      this.view.showEditError(messageOf(error, 'No se pudo actualizar la ficha.'));
    }
  }

  private handleDeleteConfirm(id: number): void {
    const artwork = ArtworkModel.findById(id);
    const title = artwork?.title ?? 'La obra';

    try {
      const deleted = ArtworkModel.delete(id);
      this.view.closeDelete();
      this.refreshGallery();
      this.view.showToast(
        deleted ? `«${title}» se eliminó del archivo SQLite.` : 'La obra ya había sido eliminada.',
        deleted ? 'success' : 'info',
      );
    } catch (error) {
      this.view.closeDelete();
      this.view.showToast(messageOf(error, 'No se pudo eliminar la obra.'), 'error');
    }
  }

  private handleLightboxAction(action: 'download' | 'edit', id: number): void {
    const artwork = ArtworkModel.findById(id);
    if (!artwork) {
      this.view.closeLightbox();
      this.refreshGallery();
      this.view.showToast('La obra ya no existe en el archivo.', 'info');
      return;
    }

    if (action === 'download') {
      this.exportPng(artwork);
      return;
    }

    this.view.closeLightbox();
    this.view.openEdit(artwork);
  }

  private exportPng(artwork: Artwork): void {
    try {
      downloadArtworkPng(specOf(artwork), artwork.title, artwork.seed);
      this.view.showToast(`PNG 2000 × 2000 exportado: «${artwork.title}».`, 'success');
    } catch (error) {
      this.view.showToast(messageOf(error, 'No se pudo exportar la imagen.'), 'error');
    }
  }
}
