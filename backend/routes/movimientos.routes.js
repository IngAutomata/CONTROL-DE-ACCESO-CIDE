const express = require("express");
const router = express.Router();

const { registrarMovimiento } = require("../controllers/movimientos.controller");

router.post("/registrar", registrarMovimiento);

module.exports = router;