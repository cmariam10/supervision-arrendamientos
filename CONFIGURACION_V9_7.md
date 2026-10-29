# Versión 9.7: autenticación individual y autollenado privado

**Estado:** código preparado e integrado, pendiente de que la administradora configure/despliegue Supabase y los secretos de Microsoft Graph. **No se puede afirmar que el autollenado está funcionando en producción hasta completar estos pasos y hacer una prueba con el Local 1001.**

## 1. Preparar Supabase

1. Crear un proyecto en https://supabase.com/dashboard.
2. Ir a **Authentication > Providers > Email**: habilitar Email; deshabilitar el registro público (configuración de signups), y exigir correo verificado. En **URL Configuration**, establecer Site URL como `https://cmariam10.github.io/supervision-arrendamientos/` y agregar la misma URL a Redirect URLs.
3. Ejecutar `supabase/sql/001_autorizaciones.sql` en **SQL Editor**.
4. En **Authentication > Users**, utilizar **Invite user** para invitar de manera individual los 3 correos aprobados. Cada persona deberá activar su cuenta y definir una contraseña. **No crear usuarios de prueba con correos ajenos.**
5. Insertar SOLO los correos realmente autorizados en `public.supervisores_autorizados`, por ejemplo `insert into public.supervisores_autorizados(email) values ('correo-autorizado@ejemplo.com');` (sustituir ejemplo).
6. En **Project Settings > API**, copiar Project URL y la clave publicable (o anon key) a `js/config.js`. NO copiar la service_role ni las contraseñas a GitHub.

## 2. Preparar permisos de Microsoft Graph

La aplicación existente de Entra debe conservar el acceso **Files.SelectedOperations.Selected** otorgado específicamente a `Consolidado.xlsx`. La federación de identidad de GitHub Actions sirve para sincronización mensual, **no** para invocar Graph desde Supabase. En Entra > App registrations > aplicación > Certificates & secrets, crear un **client secret** con caducidad controlada. Guardarlo únicamente en secretos de Supabase; nunca en código, GitHub, capturas o chats.

## 3. Publicar función privada

Con Supabase CLI, desde la raíz del proyecto, una vez autenticado el propietario:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set AZURE_TENANT_ID=TU_TENANT_ID AZURE_CLIENT_ID=TU_CLIENT_ID AZURE_CLIENT_SECRET=TU_CLIENT_SECRET MAP_ID_SALT=TU_MAP_ID_SALT GRAPH_DRIVE_ID=TU_DRIVE_ID GRAPH_ITEM_ID=TU_ITEM_ID ALLOWED_ORIGIN=https://cmariam10.github.io
supabase functions deploy inmueble --no-verify-jwt
```

**Sobre `--no-verify-jwt`:** es necesario cuando el proyecto utiliza claves publicables modernas y la verificación de JWT se hace dentro de la función mediante `auth.getUser`. La función **rechaza** toda llamada sin token válido, correo presente y activo en `supervisores_autorizados`; este parámetro NO significa consulta anónima. Supabase también proporciona automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a funciones alojadas (verificar en la configuración del proyecto). No modificar la función para omitir validaciones.

Evitar pegar secretos en historial de shell; alternativamente, establecerlos desde **Edge Functions > Secrets** en el Dashboard. **MAP_ID_SALT debe ser exactamente igual al secreto existente en GitHub Actions** o los identificadores no coincidirán.

**`ALLOWED_ORIGIN` es la origin del navegador sin ruta:** `https://cmariam10.github.io`.

## 4. Subir el visor

Copiar archivos al repositorio GitHub `supervision-arrendamientos` con GitHub Desktop. Actualizar `js/config.js` con el URL del proyecto y su clave pública. Hacer Commit y Push. No incluir ninguna clave privada, nombres ni cédulas en `data/inmuebles.json`.

## 5. Prueba de aceptación

1. Una persona sin autorización no debe poder consultar `inmueble` ni entrar al visor con credenciales válidas pero no autorizadas.
2. Un supervisor autorizado inicia sesión con su correo y contraseña.
3. Busca **Centro Comercial Bolívar Prado Local 1001**, selecciona su ficha y abre formulario.
4. Verificar contrato `A00527`, arrendatario `Oscar de Jesus Osorio Herrera`, matrícula `5169813`, fechas `30/01/2026` y `29/01/2028`, canon `266591` y su conversión a letras. Los datos se toman de la fila **actual** de `Inventario`, no se incluyen en el código.
5. Confirmar que el acceso es válido para los inmuebles asignados a cualquier supervisor, y que el código fuente público no incluye información contractual.
6. Generar Word y revisar sustitución de marcadores en la plantilla. La subida automática a OneDrive **todavía no está implementada**.

## Observaciones de seguridad y operación

- Los emails personales y servicios externos deben estar autorizados por el responsable de protección de datos de la institución.
- La contraseña individual puede ser revocada desactivando usuario o estableciendo `activo=false`; cada función valida ambos permisos.
- `data/inmuebles.json` continúa siendo públicamente accesible en GitHub aunque el visor muestre una pantalla de acceso. Si es obligatorio proteger también la ubicación y la lista completa, hay que mover esa carga a la API privada.
- El flujo de recuperación/invitación de contraseña usa correos de Supabase; configure SMTP apropiado para operación y su política de expiración de sesiones.
