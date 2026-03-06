const express = require("express");
const router = express.Router();

const { primerIngreso, obtenerPorDocumento } = require("../controllers/estudiantes.controller");

router.get("/", (_req, res) => res.send("Rutas estudiantes OK"));
router.post("/primer-ingreso", primerIngreso);
router.get("/:documento", obtenerPorDocumento);

module.exports = router;
