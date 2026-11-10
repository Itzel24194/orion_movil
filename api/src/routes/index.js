const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/promociones', require('./promociones')); // rutas con sesión; las públicas siguen en catalogo
router.use('/complexion', require('./complexion'));
router.use('/', require('./catalogo'));            // /productos /categorias /marcas /combos /promociones /resenas
router.use('/carrito', require('./carrito'));
router.use('/pedidos', require('./pedidos'));
router.use('/cuenta', require('./cuenta'));        // perfil, direcciones, favoritos, intereses, pagos, cupones…
router.use('/monedero', require('./monedero'));
router.use('/lealtad', require('./lealtad'));
router.use('/mesa-regalos', require('./mesa-regalos'));
router.use('/marketplace', require('./marketplace'));
router.use('/admin', require('./admin'));
router.use('/', require('./extras'));

router.get('/', (_req, res) => res.json({ ok: true, api: 'ORION API', version: '1.0.0',
  modulos: ['auth', 'productos', 'categorias', 'marcas', 'combos', 'promociones', 'resenas', 'carrito', 'pedidos', 'cuenta', 'complexion', 'monedero', 'lealtad', 'mesa-regalos', 'marketplace', 'admin', 'newsletter', 'contacto', 'chat'] }));

module.exports = router;
