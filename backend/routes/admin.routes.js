const express = require("express");
const router = express.Router();

const { requireRole } = require("../middleware/requireRole");
const { ROLES } = require("../constants/roles");

router.use(requireRole(ROLES.ADMIN));

router.get("/reportes", async (_req, res) => {
  return res.status(200).json({
    message: "Reportes administrativos",
  });
});

router.get("/usuarios", async (_req, res) => {
  return res.status(200).json({
    message: "Gestion de usuarios (pendiente de implementacion)",
  });
});

module.exports = router;
