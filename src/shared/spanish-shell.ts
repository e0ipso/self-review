import type { LocalizedMessage } from '../../packages/react/src/localization/formatter';

/** Desktop shell and native presentation. User content and engine diagnostics stay verbatim. */
export const SPANISH_SHELL = {
  Continue: 'Continuar',
  Cancel: 'Cancelar',
  'Large Review Detected': 'Revisión de gran tamaño',
  'Review size': {
    plural: 'files',
    forms: {
      one: {
        plural: 'lines',
        forms: {
          one: 'Esta revisión contiene {files} archivo y aproximadamente {lines} línea.',
          other: 'Esta revisión contiene {files} archivo y aproximadamente {lines} líneas.',
        },
      },
      other: {
        plural: 'lines',
        forms: {
          one: 'Esta revisión contiene {files} archivos y aproximadamente {lines} línea.',
          other: 'Esta revisión contiene {files} archivos y aproximadamente {lines} líneas.',
        },
      },
    },
  },
  'Review thresholds': {
    plural: 'files',
    forms: {
      one: {
        plural: 'lines',
        forms: {
          one: 'Límites: {files} archivo, {lines} línea.\n\nLas revisiones grandes pueden ser lentas. ¿Continuar en modo de carga diferida?',
          other:
            'Límites: {files} archivo, {lines} líneas.\n\nLas revisiones grandes pueden ser lentas. ¿Continuar en modo de carga diferida?',
        },
      },
      other: {
        plural: 'lines',
        forms: {
          one: 'Límites: {files} archivos, {lines} línea.\n\nLas revisiones grandes pueden ser lentas. ¿Continuar en modo de carga diferida?',
          other:
            'Límites: {files} archivos, {lines} líneas.\n\nLas revisiones grandes pueden ser lentas. ¿Continuar en modo de carga diferida?',
        },
      },
    },
  },
  'Choose a directory to apply suggestions into':
    'Elige un directorio donde aplicar las sugerencias',
  'Save Review As': 'Guardar revisión como',
  'XML Files': 'Archivos XML',
  'Review not saved': 'Revisión sin guardar',
  OK: 'Aceptar',
  'Review window unavailable': 'Ventana de revisión no disponible',
  'The review window stopped unexpectedly.': 'La ventana de revisión se cerró inesperadamente.',
  'The review window is not responding.': 'La ventana de revisión no responde.',
  'The current review cannot be saved from this window. Discard the review and quit, or cancel to keep the window open.':
    'No se puede guardar la revisión actual desde esta ventana. Descarta la revisión y sal, o cancela para mantener la ventana abierta.',
  'Discard & Quit': 'Descartar y salir',
  'Review saved': 'Revisión guardada',
  'The review was saved, but this window did not acknowledge it.':
    'La revisión se guardó, pero esta ventana no lo confirmó.',
  'Closing discards any unsaved work in this window. The saved output stays on disk. Close the application, or cancel to keep the window open.':
    'Al cerrar se descarta el trabajo sin guardar de esta ventana. El resultado guardado permanece en el disco. Cierra la aplicación o cancela para mantener la ventana abierta.',
  Close: 'Cerrar',
  View: 'Ver',
  Documentation: 'Documentación',
  About: 'Acerca de',
  'The review window did not hand over its review state, so nothing was written.':
    'La ventana de revisión no entregó su estado, por lo que no se escribió nada.',
  'The review is still open. Try saving again.':
    'La revisión sigue abierta. Intenta guardarla de nuevo.',
  'Could not save the review: {message}': 'No se pudo guardar la revisión: {message}',
  'The review was not written. Fix the problems listed above and save again.':
    'La revisión no se escribió. Corrige los problemas indicados arriba y vuelve a guardarla.',
  'The review was not written. Remove the character named above from that comment and save again.':
    'La revisión no se escribió. Elimina de ese comentario el carácter indicado arriba y vuelve a guardarla.',
  'Click Change... in the file tree to pick another output path, then save again.':
    'Pulsa Cambiar... en el árbol de archivos para elegir otra ruta de salida y vuelve a guardar.',
  'Free some disk space, or click Change... in the file tree to save elsewhere.':
    'Libera espacio en el disco o pulsa Cambiar... en el árbol de archivos para guardar en otro lugar.',
  'Click Change... to save next to the resumed review, or remove that attachment, then save again.':
    'Pulsa Cambiar... para guardar junto a la revisión retomada, o elimina ese adjunto y vuelve a guardar.',
  'The review is still open. Try saving again, or click Change... to save elsewhere.':
    'La revisión sigue abierta. Intenta guardarla de nuevo o pulsa Cambiar... para guardar en otro lugar.',
  'Loading review': 'Cargando revisión',
  Retry: 'Reintentar',
  'The review is still loading or could not be restored. Resolve the loading error before saving.':
    'La revisión sigue cargándose o no se pudo restaurar. Resuelve el error de carga antes de guardar.',
  'The host could not accept the review state. {detail}':
    'El anfitrión no pudo aceptar el estado de la revisión. {detail}',
  'Saving review…': 'Guardando revisión…',
  'The save outcome is unknown. Check the output file before closing. The review has not been resent.':
    'Se desconoce el resultado del guardado. Comprueba el archivo de salida antes de cerrar. La revisión no se ha vuelto a enviar.',
  'Check publication status': 'Comprobar estado del guardado',
  'Discarding closes unsaved work. Anything already written stays on disk.':
    'Al descartar se cierra el trabajo sin guardar. Lo que ya se haya escrito permanece en el disco.',
  'Version {version}': 'Versión {version}',
  'GitHub-style PR review UI for local git diffs':
    'Interfaz de revisión al estilo de GitHub para diferencias locales de git',
  'Save your review?': '¿Guardar la revisión?',
  'You have unsaved review work. What would you like to do?':
    'Hay trabajo de revisión sin guardar. ¿Qué quieres hacer?',
  Discard: 'Descartar',
  'Save & Quit': 'Guardar y salir',
  '{active} of {total}': '{active} de {total}',
  'No results': 'Sin resultados',
  'Search is too long. Use at most {limit} characters.':
    'La búsqueda es demasiado larga. Usa como máximo {limit} caracteres.',
  'Find in page': 'Buscar en la página',
  'Find...': 'Buscar...',
  'Previous match': 'Coincidencia anterior',
  'Previous match (Shift+Enter)': 'Coincidencia anterior (Shift+Enter)',
  'Next match': 'Siguiente coincidencia',
  'Next match (Enter)': 'Siguiente coincidencia (Enter)',
  'Close find bar': 'Cerrar barra de búsqueda',
  'Close (Escape)': 'Cerrar (Escape)',
  'Self Review v{version} is available.': 'Self Review v{version} está disponible.',
  'View release': 'Ver versión',
  Dismiss: 'Ocultar',
  'Failed to choose directory': 'No se pudo elegir el directorio',
  'Not a recognized PR/MR URL. Expected a GitHub pull request (…/pull/N) or GitLab merge request (…/-/merge_requests/N) URL.':
    'URL de PR/MR no reconocida. Se esperaba una URL de pull request de GitHub (…/pull/N) o de merge request de GitLab (…/-/merge_requests/N).',
  'Failed to open remote PR/MR': 'No se pudo abrir el PR/MR remoto',
  'Failed to start review': 'No se pudo iniciar la revisión',
  'GitHub-style PR review UI for local git diffs. Designed for solo developers reviewing AI-generated code.':
    'Interfaz de revisión al estilo de GitHub para diferencias locales de git. Diseñada para desarrolladores que revisan por su cuenta código generado por IA.',
  'Git Mode': 'Modo git',
  'Runs git diff to show actual changes in your repository':
    'Ejecuta git diff para mostrar los cambios del repositorio',
  'Launch from the CLI with diff arguments to use this mode.':
    'Inicia desde la línea de comandos con argumentos de diff para usar este modo.',
  'Remote Mode': 'Modo remoto',
  'Review a GitHub pull request or GitLab merge request by URL':
    'Revisa un pull request de GitHub o un merge request de GitLab mediante su URL',
  'GitHub PR or GitLab MR URL': 'URL de PR de GitHub o MR de GitLab',
  'Loading...': 'Cargando...',
  Open: 'Abrir',
  'Directory Mode': 'Modo directorio',
  'Shows all files as new additions — useful for reviewing generated code':
    'Muestra todos los archivos como nuevos, útil para revisar código generado',
  'Browse...': 'Examinar...',
  'Start Review': 'Iniciar revisión',
} satisfies Record<string, LocalizedMessage>;
