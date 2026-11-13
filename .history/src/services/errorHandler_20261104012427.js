// services/errorHandler.js
const MENSAJES_SEGUROS = {
    400: 'Los datos enviados no son válidos. Revisa el formulario.',
    401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    403: 'No tienes permisos para esta acción.',
    404: 'El recurso no existe.',
    409: 'Ya existe un registro igual o hay un conflicto.',
    413: 'El archivo es demasiado grande.',
    429: 'Demasiadas solicitudes. Espera un momento.',
    500: 'Ocurrió un error en el servidor. Intenta más tarde.',
    0: 'Sin conexión. Verifica tu red.',
};

export function mensajeSeguro(error) {
    if (!error) return 'Error desconocido';
    const status = error.status || 0;
    return MENSAJES_SEGUROS[status] || 'Ocurrió un error inesperado.';
}