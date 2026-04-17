const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");
const {
  aprobarSolicitudInscripcion,
  crearSolicitudInscripcion,
  listarSolicitudesInscripcion,
  obtenerSolicitudInscripcion,
  rechazarSolicitudInscripcion,
} = require("../controllers/solicitudes-inscripcion.controller");

const router = express.Router();

router.post("/", crearSolicitudInscripcion);

router.use(authMiddleware);
router.use(requireRole(ROLES.ADMIN));

router.get("/", listarSolicitudesInscripcion);
router.get("/:id", obtenerSolicitudInscripcion);
router.patch("/:id/aprobar", aprobarSolicitudInscripcion);
router.patch("/:id/rechazar", rechazarSolicitudInscripcion);

module.exports = router;
