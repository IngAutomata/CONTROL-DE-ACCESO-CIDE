const express = require("express");
const router = express.Router();

const {
  registrarMovimiento,
  listarMovimientos,
  listarMovimientosPorEstudiante,
  listarDentroCampus,
} = require("../controllers/movimientos.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

const ROLES_LECTURA = [ROLES.ADMIN, ROLES.GUARDA, ROLES.CONSULTA];

router.use(authMiddleware);

router.post("/registrar", requireRole(ROLES.ADMIN, ROLES.GUARDA), registrarMovimiento);
router.get("/", requireRole(ROLES_LECTURA), listarMovimientos);
router.get("/estudiante/:id", requireRole(ROLES_LECTURA), listarMovimientosPorEstudiante);
router.get("/dentro-campus", requireRole(ROLES_LECTURA), listarDentroCampus);

module.exports = router;
