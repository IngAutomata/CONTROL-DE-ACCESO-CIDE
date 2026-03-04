const express = require("express");
const router = express.Router();

const { primerIngreso } = require("../controllers/estudiantes.controller");


// ✅ Ruta de prueba
router.get("/", (req, res) => res.send("Rutas estudiantes OK"));

// ✅ Tu endpoint principal
router.post("/primer-ingreso", primerIngreso);



module.exports = router;