# Visor de Bienes — Supervisión de Arrendamientos (Etapa 2)

## Publicar en GitHub Pages
1. Crear un repositorio nuevo **privado** (o publicar únicamente el código, sin datos internos).
2. Descomprimir y cargar el contenido de `visor-supervision-bienes/` a la raíz del repositorio (incluyendo `index.html`, `css/`, `js/`).
3. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, elegir `main` y `/ (root)`; guardar. La disponibilidad de Pages con repositorio privado depende del plan y de la política de la organización.
4. Abrir la URL que GitHub Pages indique. No subir `BASE_HUB_AGRUPADA.xlsx` ni `Registro.xlsx` al repositorio.
5. Usar **Importar Excel** y elegir `BASE_HUB_AGRUPADA.xlsx`. El archivo se interpreta localmente en el navegador; no se transmite a nuestro servidor ni se publica por el código de la aplicación.

## Fuente del mapa
- Fondo cartográfico: teselas OpenStreetMap mediante Leaflet.
- Marcadores: campos `LATITUD` y `LONGITUD` del Excel maestro, sin geocodificación ni coordenadas inventadas.
- Para mostrar **polígonos catastrales reales** hace falta una capa GIS autorizada (GeoJSON/Feature Service) con identificador común (`ID_INMUEBLE`, `CBML` o ID espacial). Este prototipo muestra puntos, NO límites prediales.

## Autollenado del informe
Seleccionar inmueble → Preparar informe de supervisión descarga una **ficha de datos preliminar TXT**. Los campos de identificación, dirección, matrícula, CBML, activo fijo y contrato que existan en la base se cargan automáticamente. Hay que validarlos antes de emitir Word; muchos campos contractuales pueden estar vacíos, agregados o tener varias relaciones. La plantilla Word FO-ADMI-123 aún NO se genera.

## Limitaciones y seguridad
- Los registros manuales/importados viven solamente en `localStorage` de ese navegador. NO se sincronizan con otros inspectores.
- El archivo maestro puede exceder la cuota de almacenamiento local; para producción usar backend con autenticación y almacenamiento institucional.
- No hay integración con Microsoft Graph, SharePoint, Registro.xlsx ni envío por correo. No se deben añadir claves privadas de Graph al JavaScript de GitHub Pages.
- La hoja de inspección, el Word completo, permisos para inspectores y control de versiones se desarrollarán en la fase siguiente.
- Las coordenadas y el uso de los datos deben verificarse según los permisos institucionales antes de compartir el visor públicamente.
