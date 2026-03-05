const express = require("express");
const router = express.Router();

const { primerIngreso, obtenerPorDocumento } = require("../controllers/estudiantes.controller");

// ✅ Ruta de prueba
router.get("/", (req, res) => res.send("Rutas estudiantes OK"));

// ✅ Tu endpoint principal
router.post("/primer-ingreso", primerIngreso);
router.get("/:documento", obtenerPorDocumento);



module.exports = router;