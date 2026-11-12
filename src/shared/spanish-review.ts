import type { ENGLISH } from '../../packages/react/src/localization/english';
import type { LocalizedMessage } from '../../packages/react/src/localization/formatter';

/** Built-in translations for the shared review UI used by desktop. */
export const SPANISH_REVIEW = {
  Original: 'Original',
  Suggested: 'Propuesto',
  'Enter your suggested code...': 'Escribe el código propuesto...',
  'Finish or cancel unfinished drafts before saving the review.':
    'Termina o cancela los borradores pendientes antes de guardar la revisión.',
  'The reviewed content changed. Check this draft against the current diff before continuing.':
    'El contenido revisado ha cambiado. Comprueba este borrador con el diff actual antes de continuar.',
  'Use current location': 'Usar la ubicación actual',
  'Keep as file comment': 'Conservar como comentario de archivo',
  'Attachment preparation was interrupted. Attach the image again before saving.':
    'La preparación del adjunto se interrumpió. Vuelve a adjuntar la imagen antes de guardar.',
  'Unfinished drafts': 'Borradores pendientes',
  'Unfinished draft: {path}': 'Borrador pendiente: {path}',
  'Continue draft': 'Continuar borrador',
  'Cancel draft': 'Cancelar borrador',

  'Front matter too complex to display: it refers to itself. The document body is shown below.':
    'Los metadatos se refieren a sí mismos. El cuerpo del documento se muestra debajo.',
  'Front matter too complex to display: it is nested too deeply. The document body is shown below.':
    'Los metadatos están demasiado anidados para mostrarlos. El cuerpo del documento se muestra debajo.',
  'Front matter too complex to display: it has too many values. The document body is shown below.':
    'Los metadatos tienen demasiados valores para mostrarlos. El cuerpo del documento se muestra debajo.',
  null: 'nulo',
  'A line range is required to apply this suggestion.':
    'Se necesita un intervalo de líneas para aplicar esta sugerencia.',
  'Deleted lines cannot be applied to the working file.':
    'Las líneas eliminadas no se pueden aplicar al archivo de trabajo.',
  'The suggestion has an invalid line range.':
    'La sugerencia tiene un intervalo de líneas no válido.',
  'The destination must be an absolute path.': 'El destino debe ser una ruta absoluta.',
  'The destination does not exist.': 'El destino no existe.',
  'The file path is outside the destination.': 'La ruta del archivo está fuera del destino.',
  'Git control files cannot be changed.': 'Los archivos de control de Git no se pueden cambiar.',
  'The destination file cannot be replaced safely.':
    'El archivo de destino no se puede reemplazar de forma segura.',
  'Replacing the file would change its owner.': 'Reemplazar el archivo cambiaría su propietario.',
  'The file is missing from the destination.': 'El archivo no está en el destino.',
  'The destination file could not be read.': 'No se pudo leer el archivo de destino.',
  'The destination file is not valid UTF-8.': 'El archivo de destino no es UTF-8 válido.',
  'The line range is outside the destination file.':
    'El intervalo de líneas está fuera del archivo de destino.',
  'The original code no longer matches the destination.':
    'El código original ya no coincide con el destino.',
  'The file changed while the suggestion was being applied.':
    'El archivo cambió mientras se aplicaba la sugerencia.',
  'The suggestion could not be written.': 'No se pudo escribir la sugerencia.',
  'Choose a destination before applying this suggestion.':
    'Elige un destino antes de aplicar esta sugerencia.',
  'This review has no writable destination.': 'Esta revisión no tiene un destino de escritura.',
  'This file is not in the reviewed diff.': 'Este archivo no está en el diff revisado.',
  'The destination must be a directory.': 'El destino debe ser un directorio.',
  'Choose a destination outside the temporary clone.': 'Elige un destino fuera del clon temporal.',
  'Add bold text (ctrl + b)': 'Añadir negrita (ctrl + b)',
  'Add italic text (ctrl + i)': 'Añadir cursiva (ctrl + i)',
  'Insert a quote (ctrl + q)': 'Insertar cita (ctrl + q)',
  'Insert code (ctrl + j)': 'Insertar código (ctrl + j)',
  'Add a link (ctrl + l)': 'Añadir enlace (ctrl + l)',
  'Add unordered list (ctrl + shift + u)': 'Añadir lista sin ordenar (ctrl + shift + u)',
  'Add ordered list (ctrl + shift + o)': 'Añadir lista ordenada (ctrl + shift + o)',
  'Add checked list (ctrl + shift + c)': 'Añadir lista de tareas (ctrl + shift + c)',
  'Emoji suggestions': 'Sugerencias de emojis',
  'Emoji {name}': 'Emoji {name}',
  'Emoji suggestion {index} of {count}: {name}. Use Up and Down to choose, Enter or Tab to insert, Escape to close.':
    'Sugerencia de emoji {index} de {count}: {name}. Usa Arriba y Abajo para elegir, Enter o Tab para insertar, Escape para cerrar.',
  'The host rejected the request before applying the proposal.':
    'El anfitrión rechazó la solicitud antes de aplicar la propuesta.',
  'The apply outcome is unknown. Inspect the destination file before allowing another attempt. Nothing is retried automatically.':
    'Se desconoce el resultado de la aplicación. Inspecciona el archivo de destino antes de permitir otro intento. No se reintenta nada automáticamente.',
  'I inspected the destination file and confirmed this proposal was not applied.':
    'He inspeccionado el archivo de destino y he confirmado que esta propuesta no se aplicó.',
  'Allow a separate retry': 'Permitir otro intento',
  'Suggested change': 'Cambio sugerido',
  'this review host cannot load file content on demand':
    'este anfitrión de revisión no puede cargar el contenido de los archivos bajo demanda',
  'the review host returned no content for this file':
    'el anfitrión de revisión no devolvió contenido para este archivo',
  'the request failed': 'la solicitud falló',
  'Part of this diff could not be reviewed': 'No se pudo revisar parte de estas diferencias',
  'Side-by-side view': 'Vista en paralelo',
  'Unknown signal': 'Señal desconocida',
  'line {line}': 'línea {line}',
  'lines {start}–{end}': 'líneas {start}–{end}',
  Orphaned: 'Sin anclaje',
  critical: 'crítico',
  major: 'grave',
  minor: 'leve',
  info: 'informativo',
  'high confidence': 'confianza alta',
  'medium confidence': 'confianza media',
  'low confidence': 'confianza baja',
  'Critical: data loss, a security hole, or a crash on a path real usage reaches.':
    'Crítico: pérdida de datos, un fallo de seguridad o un cierre inesperado en un caso de uso real.',
  'Major: wrong behaviour or a broken contract on a path real usage reaches.':
    'Grave: comportamiento incorrecto o incumplimiento de un contrato en un caso de uso real.',
  'Minor: real but bounded. Behaviour is correct today.':
    'Leve: real pero limitado. El comportamiento actual es correcto.',
  'Info: no defect. Style, naming, a question, or a note.':
    'Informativo: sin defecto. Estilo, nombres, una pregunta o una nota.',
  'High confidence: traceable from the diff, no unverified assumption needed.':
    'Confianza alta: se puede comprobar en las diferencias, sin supuestos sin verificar.',
  'Medium confidence: rests on one assumption the author did not verify.':
    'Confianza media: depende de un supuesto que el autor no verificó.',
  'Low confidence: speculative. Worth your eyes, not worth acting on unattended.':
    'Confianza baja: especulativo. Merece una lectura, pero no actuar sin supervisión.',
  'Expand up': 'Ampliar hacia arriba',
  'Expand down': 'Ampliar hacia abajo',
  'Show all hidden lines': 'Mostrar todas las líneas ocultas',
  'Show hidden lines': {
    plural: 'count',
    forms: { one: 'Mostrar {count} línea oculta', other: 'Mostrar {count} líneas ocultas' },
  },
  'Context could not be loaded. Use an expand button to try again.':
    'No se pudo cargar el contexto. Usa un botón de ampliación para reintentarlo.',
  Guided: 'Guiada',
  Flat: 'Plana',
  'Group files by the review walkthrough': 'Agrupar archivos según el recorrido de revisión',
  'Flat file list (diff order)': 'Lista plana de archivos (orden de las diferencias)',
  'Light theme': 'Tema claro',
  'Dark theme': 'Tema oscuro',
  'System theme': 'Tema del sistema',
  'Finish Review': 'Finalizar revisión',
  'Changed files': 'Archivos cambiados',
  'Split view': 'Vista dividida',
  'Unified view': 'Vista unificada',
  'Keyboard shortcuts': 'Atajos de teclado',
  'Change...': 'Cambiar...',
  'Copy file path': 'Copiar ruta del archivo',
  Raw: 'Sin procesar',
  Rendered: 'Renderizado',
  'Add comment': 'Añadir comentario',
  'Add file comment': 'Añadir comentario al archivo',
  Attach: 'Adjuntar',
  Cancel: 'Cancelar',
  'Loading file content...': 'Cargando contenido del archivo...',
  'The content of this file could not be loaded.':
    'No se pudo cargar el contenido de este archivo.',
  'Nothing will be requested again until you retry. If the review host stopped, restart it and then retry.':
    'No se volverá a solicitar nada hasta que lo reintentes. Si el anfitrión de revisión se detuvo, reinícialo y vuelve a intentarlo.',
  Retry: 'Reintentar',
  'Binary file — no diff available': 'Archivo binario, diferencias no disponibles',
  'No changes to display': 'No hay cambios que mostrar',
  'Hide New Files': 'Ocultar archivos nuevos',
  'Show New Files': 'Mostrar archivos nuevos',
  'Hide new files not yet in git': 'Ocultar archivos nuevos que aún no están en git',
  'Show new files not yet in git': 'Mostrar archivos nuevos que aún no están en git',
  'Expand Comments': 'Expandir comentarios',
  'Collapse Comments': 'Contraer comentarios',
  'Expand all comments': 'Expandir todos los comentarios',
  'Collapse all comments': 'Contraer todos los comentarios',
  'Directory: {path}': 'Directorio: {path}',
  'File: {path}': 'Archivo: {path}',
  'Wrap Lines': 'Ajustar líneas',
  'No Wrap': 'Sin ajuste',
  'Wrap long lines': 'Ajustar líneas largas',
  'Scroll long lines horizontally': 'Desplazar horizontalmente las líneas largas',
  "Output path is not writable. Click 'Change...' in the file tree to pick a save location.":
    "No se puede escribir en la ruta de salida. Pulsa 'Cambiar...' en el árbol de archivos para elegir dónde guardar.",
  'Output path is not writable.': 'No se puede escribir en la ruta de salida.',
  'files changed': {
    plural: 'count',
    forms: { one: '{count} archivo cambiado', other: '{count} archivos cambiados' },
  },
  'Review progress': 'Progreso de revisión',
  'files viewed': {
    plural: 'total',
    forms: {
      one: '{viewed} de {total} archivo revisado ({percent}%)',
      other: '{viewed} de {total} archivos revisados ({percent}%)',
    },
  },
  'comments across files': {
    plural: 'count',
    forms: {
      one: {
        plural: 'files',
        forms: {
          one: '{count} comentario en {files} archivo',
          other: '{count} comentario en {files} archivos',
        },
      },
      other: {
        plural: 'files',
        forms: {
          one: '{count} comentarios en {files} archivo',
          other: '{count} comentarios en {files} archivos',
        },
      },
    },
  },
  'Review-level comments': 'Comentarios de la revisión',
  'Mark as needs review: {path}': 'Marcar como pendiente de revisión: {path}',
  'Mark as done reviewing: {path}': 'Marcar como revisado: {path}',
  'Mark as needs review': 'Marcar como pendiente de revisión',
  'Mark as done reviewing': 'Marcar como revisado',
  'Keyboard Shortcuts': 'Atajos de teclado',
  'Find in page': 'Buscar en la página',
  'Comment on line': 'Comentar línea',
  'Jump to file': 'Ir al archivo',
  'Scroll diffs': 'Desplazar diferencias',
  'Output:': 'Salida:',
  'Path not writable': 'No se puede escribir en la ruta',
  'Collapse all files': 'Contraer todos los archivos',
  'Expand all files': 'Expandir todos los archivos',
  'No files match your search': 'Ningún archivo coincide con la búsqueda',
  'No files in diff': 'No hay archivos en las diferencias',
  'Filter files...': 'Filtrar archivos...',
  'Collapse {path}': 'Contraer {path}',
  'Expand {path}': 'Expandir {path}',
  'Copied!': '¡Copiado!',
  'Done reviewing': 'Revisado',
  'To review': 'Por revisar',
  'Raw view': 'Vista sin procesar',
  'Rendered view': 'Vista renderizada',
  added: 'Añadido',
  deleted: 'Eliminado',
  modified: 'Modificado',
  renamed: 'Renombrado',
  copied: 'Copiado',
  untracked: 'Sin seguimiento',
  'type-changed': 'Tipo cambiado',
  unknown: 'Desconocido',
  images: { plural: 'count', forms: { one: '{count} imagen', other: '{count} imágenes' } },
  'Add your review comment... (paste or drop images here)':
    'Añade tu comentario... (pega o arrastra imágenes aquí)',
  'Comment on line {line}': 'Comentar línea {line}',
  'Comment on lines {start} to {end}': 'Comentar líneas {start} a {end}',
  'Remove suggestion': 'Eliminar sugerencia',
  Suggest: 'Sugerir',
  Update: 'Actualizar',
  Comment: 'Comentar',
  'Esc to unfocus': 'Esc para quitar el foco',
  'Comment on old line {line}': 'Comentar línea anterior {line}',
  'Comment on new line {line}': 'Comentar línea nueva {line}',
  'Comments on source lines': 'Comentarios en líneas de origen',
  'Line {line}': 'Línea {line}',
  'Lines {start} to {end}': 'Líneas {start} a {end}',
  'This file is not in the reviewed diff, so the suggestion cannot be applied.':
    'Este archivo no está en las diferencias revisadas, por lo que no se puede aplicar la sugerencia.',
  'The apply request could not be completed.': 'No se pudo completar la solicitud de aplicación.',
  'The destination could not be chosen.': 'No se pudo elegir el destino.',
  'Not applied. {detail}': 'No aplicado. {detail}',
  'This pull request was cloned into a temporary directory. Choose where to write it.':
    'Este pull request se clonó en un directorio temporal. Elige dónde escribirlo.',
  'Write the proposal into the working file.': 'Escribir la propuesta en el archivo de trabajo.',
  'Applying…': 'Aplicando…',
  'Choose destination…': 'Elegir destino…',
  Apply: 'Aplicar',
  'Applied suggestion': {
    plural: 'count',
    forms: {
      one: 'Aplicado a {path}. Se reemplazó {count} línea.',
      other: 'Aplicado a {path}. Se reemplazaron {count} líneas.',
    },
  },
  'Retry loading review': 'Reintentar cargar la revisión',
  'Retry loading saved feedback': 'Reintentar cargar los comentarios guardados',
  'The review could not be loaded. {detail}': 'No se pudo cargar la revisión. {detail}',
  'Saved feedback could not be loaded. {detail}':
    'No se pudieron cargar los comentarios guardados. {detail}',
  'Partly hidden': 'Parcialmente oculto',
  'Some lines of this range are not in the loaded diff. The recorded original code is kept for its suggestion.':
    'Algunas líneas de este rango no están en las diferencias cargadas. Se conserva el código original registrado para su sugerencia.',
  Edit: 'Editar',
  Delete: 'Eliminar',
  Reply: 'Responder',
  Expand: 'Expandir',
  Collapse: 'Contraer',
  You: 'Tú',
  AI: 'IA',
  'Image exceeds the 10 MiB file limit.': 'La imagen supera el límite de 10 MiB por archivo.',
  'Image exceeds the 16 megapixel or 8192 pixel dimension limit.':
    'La imagen supera el límite de 16 megapíxeles o de 8192 píxeles por dimensión.',
  'Use PNG, JPEG, GIF, WebP, BMP or ICO with a readable raster header.':
    'Usa PNG, JPEG, GIF, WebP, BMP o ICO con una cabecera de imagen legible.',
  'Image could not be decoded.': 'No se pudo decodificar la imagen.',
  'Choose at most {count} images totaling at most {size} MiB.':
    'Elige como máximo {count} imágenes que sumen como máximo {size} MiB.',
  'Attachment failed: {name}. {detail}': 'Falló el adjunto: {name}. {detail}',
  'Pasted image': 'Imagen pegada',
  'Preparing attachment: {name}': 'Preparando adjunto: {name}',
  'Drop image to attach': 'Suelta la imagen para adjuntarla',
  Dismiss: 'Ocultar',
  'Image not found': 'Imagen no encontrada',
  'Loading attachment...': 'Cargando adjunto...',
  'Enlarge attachment': 'Ampliar adjunto',
  Attachment: 'Adjunto',
  'Enlarged attachment preview': 'Vista previa ampliada del adjunto',
  'Attachment preview': 'Vista previa del adjunto',
  'Remove attachment': 'Eliminar adjunto',
  'The path could not be copied. Try again or copy it manually.':
    'No se pudo copiar la ruta. Inténtalo de nuevo o cópiala manualmente.',
  'Edit reply': 'Editar respuesta',
  'Delete reply': 'Eliminar respuesta',
  'Reply to this comment... (paste or drop images here)':
    'Responde a este comentario... (pega o arrastra imágenes aquí)',
  'Review walkthrough': 'Recorrido de revisión',
  'Open the walkthrough overview': 'Abrir resumen del recorrido',
  'Walkthrough route map': 'Mapa del recorrido',
  'Go to stop {index}: {name}': 'Ir a la parada {index}: {name}',
  Appendix: 'Apéndice',
  'Stop {index} of {total}': 'Parada {index} de {total}',
  '{viewed}/{total} reviewed': '{viewed}/{total} revisados',
  '{index}/{total} \u00b7 {name}': '{index}/{total} · {name}',
  'Comments outside the current diff': 'Comentarios fuera de las diferencias actuales',
  'These recorded line ranges are not in the loaded diff. Their original locations are preserved when you save.':
    'Estos rangos de líneas registrados no están en las diferencias cargadas. Sus ubicaciones originales se conservan al guardar.',
  'The rest of the review is unaffected.': 'El resto de la revisión no se ve afectado.',
  'This file could not be displayed: {path}': 'No se pudo mostrar este archivo: {path}',
  'Try again': 'Intentar de nuevo',
  'The review could not be loaded': 'No se pudo cargar la revisión',
  'The diff could not be read in a form self-review can review':
    'No se pudieron leer las diferencias en un formato que self-review pueda revisar',
  'Could not read file': 'No se pudo leer el archivo',
  'The file {path} could not be read or is empty.':
    'No se pudo leer el archivo {path} o está vacío.',
  'No files found': 'No se encontraron archivos',
  'No files found in the selected directory {path}. The directory may be empty or all files may be excluded by ignore rules.':
    'No se encontraron archivos en el directorio seleccionado {path}. Puede estar vacío o todos sus archivos pueden estar excluidos por las reglas de exclusión.',
  'No changes found': 'No se encontraron cambios',
  'All arguments are passed directly to git diff.':
    'Todos los argumentos se pasan directamente a git diff.',
  'The arguments {args} were passed to git diff. Try different arguments to see your changes.':
    'Se pasaron los argumentos {args} a git diff. Prueba otros argumentos para ver tus cambios.',
  'Common usage examples:': 'Ejemplos de uso habituales:',
  'Unstaged working tree changes (default)':
    'Cambios del árbol de trabajo sin preparar (predeterminado)',
  'Changes staged for commit': 'Cambios preparados para el commit',
  'Changes in the last commit': 'Cambios del último commit',
  'All changes since branching from main': 'Todos los cambios desde la bifurcación de main',
  'Limit diff to a specific directory': 'Limitar las diferencias a un directorio concreto',
  stops: { plural: 'count', forms: { one: '{count} parada', other: '{count} paradas' } },
  'walkthrough totals': {
    plural: 'stops',
    forms: {
      one: {
        plural: 'files',
        forms: {
          one: '{stops} parada · {files} archivo',
          other: '{stops} parada · {files} archivos',
        },
      },
      other: {
        plural: 'files',
        forms: {
          one: '{stops} paradas · {files} archivo',
          other: '{stops} paradas · {files} archivos',
        },
      },
    },
  },
  Close: 'Cerrar',
  'Everything else': 'Todo lo demás',
  files: { plural: 'count', forms: { one: '{count} archivo', other: '{count} archivos' } },
  'Resumed comments without anchors': {
    plural: 'count',
    forms: {
      one: 'No se pudo anclar un comentario retomado y se conservó como comentario del archivo:',
      other:
        'No se pudieron anclar {count} comentarios retomados y se conservaron como comentarios del archivo:',
    },
  },
  'Remote review drift':
    'Este PR/MR ha cambiado desde que se registró esta revisión ({recorded} → {live}). Los anclajes de línea pueden estar desactualizados.',
  'Highlighting is limited for this file. All source lines remain available.':
    'El resaltado está limitado para este archivo. Todas las líneas de origen siguen disponibles.',
  'Diagram source is too large ({count} characters; the limit is {limit})':
    'El código del diagrama es demasiado grande ({count} caracteres; el límite es {limit})',
  'Diagram exceeds the layout complexity limits. Read the source below.':
    'El diagrama supera los límites de complejidad de diseño. Lee el código de abajo.',
  'Rendering timed out after {seconds} seconds. Synchronous layout cannot be interrupted.':
    'El renderizado agotó el plazo de {seconds} segundos. El diseño síncrono no se puede interrumpir.',
  'The diagram did not render to a well-formed SVG image':
    'El diagrama no produjo una imagen SVG bien formada',
  'Diagram output exceeds the image size limit.':
    'El resultado del diagrama supera el límite de tamaño de imagen.',
  'Too many diagrams are waiting. Retry after another diagram finishes.':
    'Hay demasiados diagramas en espera. Reintenta cuando termine otro diagrama.',
  'Failed to render diagram. {detail}': 'No se pudo renderizar el diagrama. {detail}',
  'Mermaid error: {detail}': 'Error de Mermaid: {detail}',
  'Diagram source': 'Código del diagrama',
  'Rendering diagram...': 'Renderizando diagrama...',
  'Mermaid diagram': 'Diagrama de Mermaid',
  'Highlighting is limited for this suggestion. All code remains available.':
    'El resaltado está limitado para esta sugerencia. Todo el código sigue disponible.',
  'Loading image...': 'Cargando imagen...',
  'Image preview unavailable': 'Vista previa de imagen no disponible',
  'Failed to load image.': 'No se pudo cargar la imagen.',
  'Image loading not supported in this context.':
    'La carga de imágenes no está disponible en este contexto.',
  'SVG preview unavailable': 'Vista previa de SVG no disponible',
  'SVG content could not be extracted.': 'No se pudo extraer el contenido SVG.',
  'Failed to load SVG preview.': 'No se pudo cargar la vista previa de SVG.',
  'SVG preview': 'Vista previa de SVG',
} satisfies Record<keyof typeof ENGLISH, LocalizedMessage>;
