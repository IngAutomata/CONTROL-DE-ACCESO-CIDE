const express = require("express");
const router = express.Router();

const {
  listarUsuarios,
  crearUsuario,
  obtenerUsuarioPorUsername,
  actualizarUsuario,
  actualizarUsuarioPorUsername,
  eliminarUsuario,
  eliminarUsuarioPorUsername,
  obtenerEstudiantePorDocumento,
  obtenerEstudiantePorPlaca,
  actualizarEstudiante,
  actualizarEstudiantePorDocumento,
  eliminarEstudiante,
  eliminarEstudiantePorDocumento,
} = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

router.use(authMiddleware);
router.use(requireRole(ROLES.ADMIN));

router.get("/reportes", (_req, res) => {
  return res.status(200).json({ message: "Reportes administrativos" });
});

router.get("/usuarios", listarUsuarios);
router.get("/usuarios/username/:username", obtenerUsuarioPorUsername);
router.post("/usuarios", crearUsuario);
router.put("/usuarios/:id", actualizarUsuario);
router.delete("/usuarios/:id", eliminarUsuario);
router.put("/usuarios/username/:username", actualizarUsuarioPorUsername);
router.delete("/usuarios/username/:username", eliminarUsuarioPorUsername);
router.get("/estudiantes/documento/:documento", obtenerEstudiantePorDocumento);
router.get("/estudiantes/placa/:placa", obtenerEstudiantePorPlaca);
router.put("/estudiantes/:id", actualizarEstudiante);
router.delete("/estudiantes/:id", eliminarEstudiante);
router.put("/estudiantes/documento/:documento", actualizarEstudiantePorDocumento);
router.delete("/estudiantes/documento/:documento", eliminarEstudiantePorDocumento);

module.exports = router;
