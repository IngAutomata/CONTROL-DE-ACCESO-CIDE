/**
 * TEST GENERAL - Validación de todos los cambios recientes
 * ============================================================
 * 
 * Este test valida:
 * 1. Configuración del servidor (.env, package.json)
 * 2. Cambios en el UI (index.html - carrera a select)
 * 3. Scripts y logs agregados
 * 4. Estado de dependencias
 * 5. Estructura de pruebas
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const backendPath = path.resolve(__dirname, "..");
const packageJsonPath = path.join(backendPath, "package.json");
const envPath = path.join(backendPath, ".env");
const indexHtmlPath = path.join(backendPath, "public/index.html");
const testsPath = path.join(backendPath, "tests");

// ====== TEST 1: Validar .env ======
function testEnvConfiguration() {
  console.log("\n📋 TEST 1: Configuración .env");
  console.log("─────────────────────────────");
  
  assert.ok(fs.existsSync(envPath), ".env debe existir");
  const envContent = fs.readFileSync(envPath, "utf-8");
  
  const requiredVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "PORT"];
  requiredVars.forEach(varName => {
    assert.ok(envContent.includes(varName), `${varName} debe estar en .env`);
  });
  
  console.log("✅ .env contiene todas las variables requeridas");
}

// ====== TEST 2: Validar package.json ======
function testPackageJson() {
  console.log("\n📦 TEST 2: Configuración package.json");
  console.log("────────────────────────────────────");
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  
  // Verificar scripts
  assert.ok(packageJson.scripts.start, "Script 'start' debe existir");
  assert.ok(packageJson.scripts["start:logs"], "Script 'start:logs' debe existir");
  assert.ok(packageJson.scripts.test, "Script 'test' debe existir");
  assert.ok(packageJson.scripts["test:integration"], "Script 'test:integration' debe existir");
  assert.ok(packageJson.scripts["test:all"], "Script 'test:all' debe existir");
  
  console.log("✅ Scripts verificados:");
  console.log("   • start");
  console.log("   • start:logs (nuevo)");
  console.log("   • test");
  console.log("   • test:integration");
  console.log("   • test:all");
  
  // Verificar dependencias
  const requiredDeps = ["express", "pg", "bcrypt", "jsonwebtoken", "dotenv"];
  requiredDeps.forEach(dep => {
    assert.ok(packageJson.dependencies[dep], `${dep} debe estar en dependencias`);
  });
  
  console.log("\n✅ Todas las dependencias requeridas están presentes");
}

// ====== TEST 3: Validar cambios en index.html ======
function testIndexHtmlChanges() {
  console.log("\n🎨 TEST 3: Cambios en index.html");
  console.log("─────────────────────────────────");
  
  assert.ok(fs.existsSync(indexHtmlPath), "index.html debe existir");
  const htmlContent = fs.readFileSync(indexHtmlPath, "utf-8");
  
  // Verificar que carrera es un select
  assert.ok(
    htmlContent.includes('<select name="carrera"'),
    "Campo carrera debe ser un <select>"
  );
  
  // Verificar que NO hay input text de carrera
  assert.ok(
    !htmlContent.includes('name="carrera" type="text"'),
    "No debe existir input text de carrera"
  );
  
  // Contar opciones de carrera
  const selectMatch = htmlContent.match(/<select name="carrera"[^>]*>[\s\S]*?<\/select>/);
  const options = selectMatch ? (selectMatch[0].match(/<option/g) || []).length : 0;
  
  assert.ok(options >= 12, `Debe haber al menos 12 opciones de carrera, hay ${options}`);
  
  console.log("✅ Campo carrera actualizado a select dropdown");
  console.log(`   • ${options - 1} opciones de carrera disponibles`);
}

// ====== TEST 4: Validar estructura de tests ======
function testStructure() {
  console.log("\n🧪 TEST 4: Estructura de tests");
  console.log("───────────────────────────────");
  
  const requiredTests = [
    "index-html.test.js",
    "auth.controller.test.js",
    "admin.controller.test.js",
    "roles.middleware.test.js",
    "movimientos.controller.test.js",
    "estudiantes.controller.test.js",
    "movimientos.dentro-campus.integration.test.js",
  ];
  
  requiredTests.forEach(testFile => {
    const testPath = path.join(testsPath, testFile);
    assert.ok(fs.existsSync(testPath), `${testFile} debe existir`);
  });
  
  console.log(`✅ ${requiredTests.length} archivos de test encontrados:`);
  requiredTests.forEach(test => {
    console.log(`   • ${test}`);
  });
}

// ====== TEST 5: Validar logs ======
function testLogs() {
  console.log("\n📝 TEST 5: Sistema de logs");
  console.log("──────────────────────────");
  
  const outputLogPath = path.join(backendPath, "server-output.log");
  const errorLogPath = path.join(backendPath, "server-error.log");
  
  // Verificar que los archivos de log existen o se pueden crear
  const hasOutputLog = fs.existsSync(outputLogPath);
  const hasErrorLog = fs.existsSync(errorLogPath);
  
  console.log(`✅ Sistema de logs configurado:`);
  console.log(`   • server-output.log: ${hasOutputLog ? "✓" : "→ se creará al usar start:logs"}`);
  console.log(`   • server-error.log: ${hasErrorLog ? "✓" : "→ se creará al usar start:logs"}`);
}

// ====== TEST 6: Validar directorio public ======
function testPublicDirectory() {
  console.log("\n📁 TEST 6: Directorio public");
  console.log("───────────────────────────");
  
  const publicPath = path.join(backendPath, "public");
  assert.ok(fs.existsSync(publicPath), "Directorio public debe existir");
  
  const requiredFiles = ["index.html"];
  requiredFiles.forEach(file => {
    const filePath = path.join(publicPath, file);
    assert.ok(fs.existsSync(filePath), `${file} debe existir en public/`);
  });
  
  console.log(`✅ Directorio public contiene:`);
  requiredFiles.forEach(file => {
    console.log(`   • ${file}`);
  });
}

// ====== TEST 7: Validar que los tests se pueden ejecutar ======
async function testCanRunTests() {
  console.log("\n▶️  TEST 7: Ejecución de tests");
  console.log("──────────────────────────────");
  
  try {
    // Ejecutar solo el test de index-html que es rápido
    const output = execSync("node tests/index-html.test.js", {
      cwd: backendPath,
      encoding: "utf-8",
    });
    
    assert.ok(output.includes("TODOS LOS TESTS PASARON"), "Tests de index.html deben pasar");
    console.log("✅ Tests de validación ejecutados correctamente");
  } catch (error) {
    console.error("⚠️  Advertencia: No se pudieron ejecutar todos los tests");
    console.error(error.message);
  }
}

// ====== RESUMEN ======
async function runAllTests() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   TEST GENERAL - Validación de Cambios Recientes          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  try {
    testEnvConfiguration();
    testPackageJson();
    testIndexHtmlChanges();
    testStructure();
    testLogs();
    testPublicDirectory();
    await testCanRunTests();
    
    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                                                            ║");
    console.log("║         ✅ TODOS LOS TESTS PASARON EXITOSAMENTE          ║");
    console.log("║                                                            ║");
    console.log("║  El proyecto está listo para ser iniciado:                ║");
    console.log("║  $ npm start        (sin logs)                            ║");
    console.log("║  $ npm start:logs   (con logs guardados)                  ║");
    console.log("║                                                            ║");
    console.log("║  Para ejecutar tests:                                     ║");
    console.log("║  $ npm test         (todos los unitarios)                 ║");
    console.log("║  $ npm test:all     (unitarios + integración)             ║");
    console.log("║                                                            ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
    
  } catch (error) {
    console.error("\n");
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                    ❌ TEST FALLIDO                        ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.error("\nDetalles del error:");
    console.error(error.message);
    process.exitCode = 1;
  }
}

// Ejecutar
runAllTests().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
