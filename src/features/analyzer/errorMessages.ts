import type { AnalysisErrorCode } from '../../../shared/media-types';

export const ERROR_TITLES: Record<AnalysisErrorCode, string> = {
  invalid_url: 'URL inválida',
  unsupported_site: 'Sitio no compatible',
  private_video: 'Video privado',
  auth_required: 'Autenticación requerida',
  protected_content: 'Contenido protegido o no compatible',
  extractor_outdated: 'El motor de extracción puede estar desactualizado',
  network_error: 'Error de red',
  unknown: 'No fue posible analizar este video',
};
