const express = require("express");
const router = express.Router();

const {
  listarUsuarios,
  listarEstudiantesAdmin,
  crearUsuario,
  obtenerUsuarioPorUsername,
  actualizarUsuario,
  actualizarUsuarioPorUsername,
  eliminarUsuario,
  eliminarUsuarioPorUsername,
  reactivarUsuario,
  reactivarUsuarioPorUsername,
  obtenerEstudiantePorDocumento,
  obtenerEstudiantePorPlaca,
  actualizarEstudiante,
  actualizarEstudiantePorDocumento,
  eliminarEstudiante,
  eliminarEstudiantePorDocumento,
  obtenerEstadoDesactivacionEstudiante,
  reactivarEstudiante,
  reactivarEstudiantePorDocumento,
  registrarSalidaEstudianteAdmin,
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
router.get("/estudiantes", listarEstudiantesAdmin);
router.get("/usuarios/username/:username", obtenerUsuarioPorUsername);
router.post("/usuarios", crearUsuario);
router.put("/usuarios/:id", actualizarUsuario);
router.delete("/usuarios/:id", eliminarUsuario);
router.patch("/usuarios/:id/reactivar", reactivarUsuario);
router.put("/usuarios/username/:username", actualizarUsuarioPorUsername);
router.delete("/usuarios/username/:username", eliminarUsuarioPorUsername);
router.patch("/usuarios/username/:username/reactivar", reactivarUsuarioPorUsername);
router.get("/estudiantes/documento/:documento", obtenerEstudiantePorDocumento);
router.get("/estudiantes/placa/:placa", obtenerEstudiantePorPlaca);
router.put("/estudiantes/:id", actualizarEstudiante);
router.delete("/estudiantes/:id", eliminarEstudiante);
router.patch("/estudiantes/:id/reactivar", reactivarEstudiante);
router.put("/estudiantes/documento/:documento", actualizarEstudiantePorDocumento);
router.delete("/estudiantes/documento/:documento", eliminarEstudiantePorDocumento);
router.get("/estudiantes/documento/:documento/estado-desactivacion", obtenerEstadoDesactivacionEstudiante);
router.patch("/estudiantes/documento/:documento/reactivar", reactivarEstudiantePorDocumento);
router.post("/estudiantes/documento/:documento/registrar-salida", registrarSalidaEstudianteAdmin);

module.exports = router;
