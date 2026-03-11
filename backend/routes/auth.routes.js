const express = require("express");
const router = express.Router();

const { login } = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post("/login", login);
router.get("/me", authMiddleware, (req, res) => {
  return res.json(req.user);
});

module.exports = router;
