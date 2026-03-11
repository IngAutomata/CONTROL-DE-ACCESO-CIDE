const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

router.use(authMiddleware);
router.use(requireRole(ROLES.ADMIN));

router.get("/reportes", (_req, res) => {
  return res.status(200).json({ message: "Reportes administrativos" });
});

router.get("/usuarios", (_req, res) => {
  return res.status(200).json({ message: "Gestion de usuarios (pendiente)" });
});

module.exports = router;
