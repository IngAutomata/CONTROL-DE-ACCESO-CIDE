require("dotenv").config();

const pool = require("../config/database");
const { processExpiredSolicitudes } = require("../utils/solicitudes-expiration-runner");

async function main() {
  const expiradas = await processExpiredSolicitudes(pool);
  console.log(`[solicitudes] expiradas procesadas: ${expiradas.length}`);
}

main()
  .catch((error) => {
    console.error("[solicitudes] error al expirar solicitudes", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // no-op
    }
  });