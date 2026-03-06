const express = require("express");
const router = express.Router();

const { primerIngreso, obtenerPorDocumento } = require("../controllers/estudiantes.controller");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

router.get("/", (_req, res) => res.send("Rutas estudiantes OK"));
router.post("/primer-ingreso", requireRole(ROLES.GUARDA), primerIngreso);
router.get("/:documento", requireRole([ROLES.ADMIN, ROLES.GUARDA, ROLES.CONSULTA]), obtenerPorDocumento);

module.exports = router;
