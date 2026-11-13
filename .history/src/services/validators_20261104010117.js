export const esEmailValido = (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export const esPasswordValida = (v) =>
    String(v || '').length >= 8;

export const esTextoValido = (v, min = 3) =>
    String(v || '').trim().length >= min;

export const validarSolicitud = ({ pedido_id, tipo, descripcion }) => {
    const errores = [];
    if (!pedido_id) errores.push('Selecciona un pedido');
    if (!tipo) errores.push('Selecciona un tipo');
    if (!esTextoValido(descripcion, 10)) errores.push('La descripción debe tener al menos 10 caracteres');
    return errores;
};