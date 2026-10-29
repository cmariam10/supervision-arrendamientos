# Visor V9.6 — Autollenado contractual (integración preparada, servidor pendiente)

## Estado

El repositorio es público y GitHub Pages no puede proteger un archivo JSON que incluya `CEDULA`, `ARRENDATARIO_OCUPANTE`, `Canon Mensual` y otros campos contractuales. Por eso NO se añadieron a `data/inmuebles.json`.

El formulario incluye correspondencia exacta con los encabezados de `Consolidado.xlsx` y conversión de fechas y moneda, pero el autollenado requiere desplegar una API privada y permitir el inicio de sesión para consultar esos campos.

## Contrato de API

`GET /inmuebles/{codigo}` con `Authorization: Bearer <access_token>` verificado por el servidor (Microsoft Entra ID u otro proveedor autorizado).

La respuesta debe ser JSON:

```json
{
  "codigo": "INM-<CODIGO_OPACO_DEL_MAPA>",
  "datos": {
    "CONTRATO_RADICADO": "A00527",
    "Fecha inico contrato_restitucion": "30/01/2026",
    "Fecha finalizacion contrato": "29/01/2028",
    "DIRECCION": "...",
    "MATRICULA": "...",
    "Activo fijo": "...",
    "CBML": "...",
    "ARRENDATARIO_OCUPANTE": "...",
    "CEDULA": "...",
    "Canon Mensual": 266591,
    "Denominacion del activo fijo SAP": "...",
    "SUPERVISOR": "..."
  }
}
```

El servidor debe validar el token, el rol del supervisor y la autorización de acceso a ese inmueble. Debe obtener datos mediante Microsoft Graph desde el Excel protegido, y calcular la misma referencia opaca que `scripts/sincronizar.py` usando `MAP_ID_SALT` en servidor. Nunca envíe secretos, el Excel completo ni datos contractuales al repositorio.

En `js/config.js`, configure `window.PRIVATE_REPORT_API` con la URL HTTPS del servicio desplegado e implemente `window.privateAccessToken` para devolver un token de usuario obtenido mediante un flujo autorizado de Entra ID. No agregue tokens ni claves de cliente en JavaScript.

### Nota de integridad

El campo SUPERVISOR es un select con nombres codificados. El sistema no fuerza una coincidencia aproximada si el nombre Excel es distinto: hay que armonizar los valores con los supervisores reales (por ejemplo, en el archivo actual aparece Clara Lucia Giraldo Bustamante).

### Prueba

1. Confirmar que el nombre se sigue mostrando en el mapa.
2. Configurar una API real y el inicio de sesión para la parte contractual.
3. Seleccionar el inmueble A00527: su código opaco debe coincidir con la respuesta de la API; verificar período, dirección, matrícula, activo fijo, CBML, arrendatario, cédula y canon numérico/letras.
4. Validar visualmente el Word FO-ADMI-123 con la tipografía original.
