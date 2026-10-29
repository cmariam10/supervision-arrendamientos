// Datos mínimos del mapa son públicos. Los datos contractuales requieren una API HTTPS privada.
// NO escribir aquí claves de Graph, secretos ni datos de arrendatarios.
window.PRIVATE_REPORT_API = ''; // Ejemplo: https://api-institucional.example.gov.co
// Implementar en el proveedor de identidad una función que entregue un token válido de acceso a la API.
window.privateAccessToken = null;
