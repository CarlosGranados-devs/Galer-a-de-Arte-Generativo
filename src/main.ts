import './styles/styles.css';
import { GalleryView } from './views/GalleryView';
import { StudioController } from './controllers/StudioController';

async function bootstrap(): Promise<void> {
  const view = new GalleryView();
  const controller = new StudioController(view);

  try {
    await controller.init();
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? error.message
        : 'Error desconocido al cargar el módulo WebAssembly.';
    view.hideBoot();
    view.renderFatal(
      `No fue posible abrir la base SQLite local. ${detail} Recarga la página para intentarlo de nuevo.`,
    );
    view.showToast('No se pudo inicializar SQLite. Recarga la página para reintentar.', 'error');
  }
}

void bootstrap();
