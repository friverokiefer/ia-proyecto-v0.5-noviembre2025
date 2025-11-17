# App.tsx – Flujo y responsabilidades

Este documento describe cómo el componente `App` (ruta `src/App.tsx`) orquesta la experiencia principal de **Email Studio v2**: generación de contenido, edición, vista previa y exportación como borrador de Salesforce Marketing Cloud (SFMC).

---

## 1. Vista general

- `App` actúa como **contenedor raíz** y compone tres columnas: Sidebar (izquierda), Workspace (centro) y Preview/acciones (derecha).
- La comunicación fluye mediante *callbacks* y estado local. `App` mantiene el “estado de verdad” para lote (`batchId`), contenidos (`trios`), imágenes relacionadas (`images`) y el *preview* activo (`livePreview`).
- La descarga del borrador SFMC se gestiona localmente en `App` tras una confirmación modal (`ConfirmSendModal`).

```
Email2Sidebar  →  App (estado global)  ←  Email2Workspace
                                      ↘  EmailPreview + botones
                                       ↘ ConfirmSendModal
```

---

## 2. Estados y referencias relevantes

| Variable                | Tipo / ref                      | Uso principal                                                                 |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `batchId`               | `useState<string>`               | Identificador del lote generado por backend.                                  |
| `trios`                 | `useState<EmailTrio[]>`          | Set de variantes de contenido devuelto por `/generateEmailV2`.                |
| `images`                | `useState<EmailV2Image[]>`       | Imágenes asociadas al lote.                                                  |
| `livePreview`           | `useState<PreviewData \| null>`  | Vista previa activa seleccionada en el Workspace.                             |
| `editedRef`             | `useRef<EmailTrio[] \| null>`    | Buffer de ediciones provenientes de `Email2Workspace` sin forzar render.      |
| `isSaving` / `isUploading` | `useState<boolean>`           | Flags de progreso para guardar lote y simular envío SFMC.                     |
| `lastSavedAt` + timers  | `useState` + `useRef<number>`    | Controlan feedback visual “Guardado correctamente”.                           |
| `confirmOpen`           | `useState<boolean>`              | Abre/cierra el modal `ConfirmSendModal`.                                      |
| `sfmcNotice`            | `useState<string \| null>`       | Mensaje que informa el resultado del último “envío” SFMC.                     |

---

## 3. Interacción entre componentes

### 3.1 Email2Sidebar → App (`handleGenerated`)

1. El usuario completa el formulario y dispara la generación (`Email2Sidebar`).
2. `Email2Sidebar` recibe la respuesta `GenerateV2Response` y llama a `onGenerated`.
3. `handleGenerated` guarda `batchId`, `trios`, `images` y reinicia estados transitorios (preview, avisos, timers).

### 3.2 Email2Workspace ↔ App

- `Email2Workspace` recibe desde `App` los datos base (`batchId`, `trios`, `images`) y callbacks.
- Al modificar texto, `Email2Workspace` invoca `onEditedChange`; `App` guarda el array editado en `editedRef`.
- Al seleccionar una variante, `Email2Workspace` llama a `onPreviewChange`, generando un nuevo `livePreview` en `App`.

### 3.3 Columna derecha (Preview + acciones)

- `EmailPreview` renderiza la vista con el `livePreview` actual.
- Botón “Guardar ediciones” → `handleSaveEdits`
  1. Prepara `payload` con las ediciones (`editedRef` o `trios` originales).
  2. Ejecuta `fetch PUT /api/emails-v2/:batchId`.
  3. Muestra feedback temporal (`lastSavedAt`, `savedVisible`, `toast.success`).
- Botón “Enviar a SFMC” → `handleUploadClick`
  1. Valida que exista `batchId` y `livePreview`.
  2. Abre el modal `ConfirmSendModal` (`confirmOpen = true`).

### 3.4 ConfirmSendModal → App (`handleConfirmSend`)

1. Tras confirmar, se llama a `handleConfirmSend`.
2. Usa `resolveSelectedTrio` y `resolveSelectedImage` para identificar el set e imagen activos.
3. Construye un objeto `sfmcDraft` (metadatos, contenido, assets).
4. Invoca `downloadJson` para descargarlo localmente.
5. Cierra el modal, notifica con `toast.success` y actualiza `sfmcNotice`.

---

## 4. Ciclos de vida y efectos

- `useEffect` (vacío) se asegura de limpiar timers (`hideSavedRef`, `clearSavedRef`) al desmontar el componente.
- Helpers `resolveSelectedImage` y `resolveSelectedTrio` encapsulan la lógica de selección sin duplicarla.

---

## 5. Flujo resumido del usuario

1. **Generar**: Desde la Sidebar, se llama al backend y se almacena el lote en `App`.
2. **Editar**: En el Workspace, el usuario ajusta copys; los cambios se guardan en `editedRef`.
3. **Previsualizar**: Seleccionar un set actualiza `livePreview` para la columna derecha y el modal de confirmación.
4. **Guardar**: “Guardar ediciones” sincroniza el `batchId` con el backend y muestra feedback visual.
5. **Enviar (descargar)**: “Enviar a SFMC” abre el modal. Al confirmar, se descarga un JSON con la selección activa.

---

## 6. Dependencias clave

- `Email2Sidebar`, `Email2Workspace`, `EmailPreview`, `ConfirmSendModal`: componentes principales que interactúan con `App`.
- `apiEmailV2` (`API_BASE` y tipos `EmailTrio`, `EmailV2Image`, `GenerateV2Response`) define los contratos de datos.
- `sonner` (`toast`) aporta notificaciones de éxito/error.

---

## 7. Consideraciones de estado

- `editedRef` evita renders innecesarios, pero requiere guardar manualmente los cambios con “Guardar ediciones”.
- `livePreview` se reinicia al generar un nuevo lote; el usuario debe seleccionar nuevamente el set deseado.
- `sfmcNotice` recuerda al usuario que el envío solo genera un borrador local; no hay integración directa con SFMC.

---

## 8. Ideas de mejora (altas luces)

1. Extraer la lógica de guardado y envío a *hooks* (e.g., `useEmailDraft`) para desacoplar `App`.
2. Compartir el estado global mediante Context si futuros componentes anidados requieren acceso directo.
3. Añadir manejo de errores más preciso (estado por campo) y persistencia de “última selección” por lote.
4. Tipar `meta` en `sfmcDraft` en lugar de usar una conversión `as any`.

---

Este README complementa la documentación principal del frontend y sirve como referencia rápida para desarrolladores que toquen `App.tsx`.
