const express = require("express");
const router = express.Router();

const { registrarMovimiento, listarDentroCampus } = require("../controllers/movimientos.controller");

router.post("/registrar", registrarMovimiento);
router.get("/dentro-campus", listarDentroCampus);

module.exports = router;
