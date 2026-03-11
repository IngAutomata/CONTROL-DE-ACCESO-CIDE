const express = require("express");
const router = express.Router();

const {
  primerIngreso,
  listarEstudiantes,
  obtenerPorId,
  obtenerPorDocumento,
} = require("../controllers/estudiantes.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

const ROLES_LECTURA = [ROLES.ADMIN, ROLES.GUARDA, ROLES.CONSULTA];

router.use(authMiddleware);

router.get("/", requireRole(ROLES_LECTURA), listarEstudiantes);
router.post("/primer-ingreso", requireRole(ROLES.ADMIN, ROLES.GUARDA), primerIngreso);
router.get("/documento/:documento", requireRole(ROLES_LECTURA), obtenerPorDocumento);
router.get("/:id", requireRole(ROLES_LECTURA), obtenerPorId);

module.exports = router;
