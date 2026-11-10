const router = require('express').Router();
const { col } = require('../config/db');
const { cliente } = require('../middleware/auth');
const { ah, idFilter, ser } = require('../utils/helpers');
const tallas = require('../utils/tallas');

router.use(...cliente);

const RANGOS = { altura_cm: [100, 250], peso_kg: [25, 300], pecho_cm: [50, 200], cintura_cm: [40, 200], cadera_cm: [50, 220], hombros_cm: [30, 80], pie_cm: [15, 35] };
const OPCIONES = { genero: ['hombre', 'mujer', 'otro'], complexion: ['delgada', 'atletica', 'media', 'robusta'], preferencia_ajuste: ['ajustado', 'regular', 'holgado'] };

function validar(body = {}) {
  const out = {}, errores = [];
  for (const [k, [mn, mx]] of Object.entries(RANGOS)) {
    if (body[k] === undefined || body[k] === null || body[k] === '') continue;
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < mn || n > mx) errores.push(`${k} debe estar entre ${mn} y ${mx}`); else out[k] = n;
  }
  for (const [k, vals] of Object.entries(OPCIONES)) {
    if (body[k] === undefined || body[k] === '') continue;
    const v = String(body[k]).toLowerCase();
    if (!vals.includes(v)) errores.push(`${k} debe ser: ${vals.join(', ')}`); else out[k] = v;
  }
  return { out, errores };
}

const obtener = (req, res) => res.json({ ok: true, data: ser(req.user.complexion || {}), tiene_medidas: !!req.user.complexion && Object.keys(req.user.complexion).length > 0 });
const guardar = ah(async (req, res) => {
  const { out, errores } = validar(req.body);
  if (errores.length) return res.status(400).json({ ok: false, error: errores.join('; ') });
  if (!Object.keys(out).length) return res.status(400).json({ ok: false, error: 'No enviaste medidas válidas' });
  const nueva = { ...(req.user.complexion || {}), ...out, actualizado: new Date() };
  await col('usuarios').updateOne({ _id: req.user._id }, { $set: { complexion: nueva } });
  res.json({ ok: true, data: ser(nueva) });
});
const limpiar = ah(async (req, res) => { await col('usuarios').updateOne({ _id: req.user._id }, { $unset: { complexion: '' } }); res.json({ ok: true }); });

router.get('/', obtener);            router.get('/obtener', obtener);
router.post('/', guardar);           router.put('/', guardar);   router.post('/guardar', guardar);
router.delete('/', limpiar);         router.post('/limpiar', limpiar);

router.get('/recomendar-talla', ah(async (req, res) => {
  const m = req.user.complexion;
  if (!m || !Object.keys(m).length) return res.status(400).json({ ok: false, code: 'SIN_MEDIDAS', error: 'Guarda tus medidas primero' });
  const prod = req.query.producto_id ? await col('productos').findOne(idFilter(req.query.producto_id)) : null;
  if (req.query.producto_id && !prod) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
  const tipo = tallas.tipoDe(prod || {}, req.query.tipo);
  const rec = tallas.recomendar(tipo, m, { ajuste: m.preferencia_ajuste });
  if (!rec) return res.status(422).json({ ok: false, code: 'MEDIDAS_INSUFICIENTES', error: { superior: 'Agrega tu medida de pecho (o altura y peso)', inferior: 'Agrega tu medida de cintura (o altura y peso)', calzado: 'Agrega el largo de tu pie en cm' }[tipo] });
  const disp = prod ? tallas.ajustarADisponibles(rec, prod.tallas) : {};
  res.json({ ok: true, data: ser({ ...rec, ...disp, producto_id: prod ? String(prod._id) : null }) });
}));

module.exports = router;
