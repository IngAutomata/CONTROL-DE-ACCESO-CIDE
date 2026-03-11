const express = require("express");
const app = express();

require('dotenv').config();

const pool = require("./config/database");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const estudiantesRoutes = require("./routes/estudiantes.routes");
const movimientosRoutes = require("./routes/movimientos.routes");
const adminRoutes = require("./routes/admin.routes");

const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[request] ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/auth", authRoutes);
app.use("/estudiantes", estudiantesRoutes);
app.use("/movimientos", movimientosRoutes);
app.use("/admin", adminRoutes);

app.get("/", (_req, res) => {
  res.send("Servidor funcionando correctamente");
});

app.get("/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({
      status: "OK",
      database_time: result.rows[0].now,
    });
  } catch (error) {
    console.error("[health] error", error.message);
    res.status(500).json({ status: "DB ERROR" });
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
