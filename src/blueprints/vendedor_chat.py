# proyecto-flask/blueprints/vendedor_chat.py
import requests
from flask import Blueprint, render_template, request, session, jsonify, redirect, url_for

vendedor_chat = Blueprint('vendedor_chat', __name__, url_prefix='/vendedor/chat')
NODE_API = "http://localhost:4000/api/v1"

def _headers():
    cookie = session.get('_flask_session_cookie', '')
    return {"Cookie": f"session={cookie}", "Content-Type": "application/json"}

def _rol_ok():
    return session.get('rol') in ('vendedor', 'admin')

@vendedor_chat.get('/')
def panel():
    if not _rol_ok():
        return redirect(url_for('web.login'))
    sin_asignar = request.args.get('sin_asignar', '1')
    r = requests.get(
        f"{NODE_API}/vendedor/chat/sesiones",
        params={"sin_asignar": sin_asignar},
        headers=_headers(), timeout=10,
    )
    data = r.json() if r.ok else {"sesiones": []}
    return render_template('vendedor_chat.html', sesiones=data.get('sesiones', []))

@vendedor_chat.get('/api/sesiones')
def api_sesiones():
    if not _rol_ok():
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    filtro = request.args.get('filtro', 'activas')
    sin_asignar = request.args.get('sin_asignar', '1')
    r = requests.get(
        f"{NODE_API}/vendedor/chat/sesiones",
        params={"filtro": filtro, "sin_asignar": sin_asignar},
        headers=_headers(), timeout=10,
    )
    return jsonify(r.json()), r.status_code

@vendedor_chat.get('/api/mensajes/<sid>')
def api_mensajes(sid):
    if not _rol_ok():
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    ultimo = request.args.get('ultimo')
    params = {"ultimo": ultimo} if ultimo else {}
    r = requests.get(
        f"{NODE_API}/vendedor/chat/sesiones/{sid}/mensajes",
        params=params, headers=_headers(), timeout=10,
    )
    return jsonify(r.json()), r.status_code

@vendedor_chat.post('/api/enviar')
def api_enviar():
    if not _rol_ok():
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    body = request.get_json(force=True, silent=True) or {}
    r = requests.post(
        f"{NODE_API}/vendedor/chat/enviar",
        json=body, headers=_headers(), timeout=10,
    )
    return jsonify(r.json()), r.status_code

@vendedor_chat.post('/api/tomar/<sid>')
def api_tomar(sid):
    if not _rol_ok():
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    r = requests.post(
        f"{NODE_API}/vendedor/chat/tomar/{sid}",
        headers=_headers(), timeout=10,
    )
    return jsonify(r.json()), r.status_code

@vendedor_chat.post('/api/archivar')
def api_archivar():
    if not _rol_ok():
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    body = request.get_json(force=True, silent=True) or {}
    r = requests.post(
        f"{NODE_API}/vendedor/chat/archivar",
        json=body, headers=_headers(), timeout=10,
    )
    return jsonify(r.json()), r.status_code