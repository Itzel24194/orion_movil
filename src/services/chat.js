// services/chat.js
const API_URL = "http://TU_IP:4000/api/v1"; // ⚠️ cambia por tu IP/dominio

async function req(path, opts = {}) {
  const r = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  return r.json();
}

// Crear sesión (invitado o logueado)
export const crearSesion = (nombre = "Cliente app") =>
  req("/chat/sesion", { method: "POST", body: JSON.stringify({ nombre }) });

// Enviar mensaje (+ bot responde si autoRespuesta = true)
export const enviarMensaje = (sesion_id, texto, autoRespuesta = true) =>
  req("/chat/mensajes", {
    method: "POST",
    body: JSON.stringify({ sesion_id, texto, auto_respuesta: autoRespuesta }),
  });

// Historial / polling
export const obtenerMensajes = (sesion_id, ultimo = null) => {
  let url = `/chat/mensajes?sesion_id=${sesion_id}`;
  if (ultimo) url += `&ultimo=${encodeURIComponent(ultimo)}`;
  return req(url);
};

// Listar sesiones del cliente
export const listarSesiones = (filtro = "activas") =>
  req(`/chat/sesiones?filtro=${filtro}`);

// Archivar
export const archivarSesion = (sesion_id) =>
  req(`/chat/sesiones/${sesion_id}/archivar`, { method: "POST" });

// Sugerencia IA
export const generarIA = (sesion_id, mensaje = null) =>
  req("/chat/generar-ia", {
    method: "POST",
    body: JSON.stringify({ sesion_id, mensaje }),
  });