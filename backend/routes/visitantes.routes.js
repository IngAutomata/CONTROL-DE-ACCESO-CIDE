const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");
const {
  listarMovimientosVisitantes,
  listarVisitantes,
  listarVisitantesDentroCampus,
  obtenerVisitantePorDocumento,
  registrarMovimientoVisitante,
} = require("../controllers/visitantes.controller");

const ROLES_LECTURA = [ROLES.ADMIN, ROLES.GUARDA, ROLES.CONSULTA];

router.use(authMiddleware);

router.post('/registrar', requireRole(ROLES.ADMIN, ROLES.GUARDA), registrarMovimientoVisitante);
router.get('/', requireRole(ROLES_LECTURA), listarVisitantes);
router.get('/movimientos', requireRole(ROLES_LECTURA), listarMovimientosVisitantes);
router.get('/dentro-campus', requireRole(ROLES_LECTURA), listarVisitantesDentroCampus);
router.get('/documento/:documento', requireRole(ROLES_LECTURA), obtenerVisitantePorDocumento);

module.exports = router;