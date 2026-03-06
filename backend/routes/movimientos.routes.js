const express = require("express");
const router = express.Router();

const { registrarMovimiento, listarDentroCampus } = require("../controllers/movimientos.controller");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

router.post("/registrar", requireRole(ROLES.GUARDA), registrarMovimiento);
router.get("/dentro-campus", requireRole([ROLES.GUARDA, ROLES.ADMIN]), listarDentroCampus);

module.exports = router;
