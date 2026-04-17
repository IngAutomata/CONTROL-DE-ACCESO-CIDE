const express = require("express");
const path = require("path");
const app = express();

require("dotenv").config();

const pool = require("./config/database");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const estudiantesRoutes = require("./routes/estudiantes.routes");
const movimientosRoutes = require("./routes/movimientos.routes");
const adminRoutes = require("./routes/admin.routes");
const solicitudesInscripcionRoutes = require("./routes/solicitudes-inscripcion.routes");
const visitantesRoutes = require("./routes/visitantes.routes");
const { startSolicitudesExpirationRunner } = require("./utils/solicitudes-expiration-runner");

const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, _res, next) => {
  console.log(`[request] ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/auth", authRoutes);
app.use("/estudiantes", estudiantesRoutes);
app.use("/movimientos", movimientosRoutes);
app.use("/admin", adminRoutes);
app.use("/solicitudes-inscripcion", solicitudesInscripcionRoutes);
app.use("/visitantes", visitantesRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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
  startSolicitudesExpirationRunner();
});
