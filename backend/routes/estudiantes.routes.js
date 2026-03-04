const express = require("express");
const router = express.Router();
const { primerIngreso, obtenerPorDocumento } = require("../controllers/estudiantes.controller");

router.post("/primer-ingreso", primerIngreso);
router.get("/:documento", obtenerPorDocumento);

module.exports = router;