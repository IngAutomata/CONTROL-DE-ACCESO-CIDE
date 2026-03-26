const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const htmlPath = path.resolve(__dirname, "../public/index.html");
const htmlContent = fs.readFileSync(htmlPath, "utf-8");

function testCarreraIsSelect() {
  const hasSelect = htmlContent.includes('name="carrera"') &&
    htmlContent.includes('<select name="carrera"');
  assert.ok(hasSelect, "El campo carrera debe ser un <select>");
  console.log("PASS: Campo carrera es un select");
}

function testCarreraOptions() {
  const expectedOptions = [
    "Tecnico Profesional en Mantenimiento de Sistemas Mecatronicos Industriales - 108538",
    "Tecnico Profesional Procesos de Redes y Comunicaciones - 109639",
    "Tecnico Profesional en Instalaciones Electricas para Sistemas Renovables - 108879",
    "Tecnologo Electrico en Generacion y Gestion Eficiente de Energias Renovables - 108524",
    "Tecnologo en Gestion de Sistemas Mecatronicos Industriales - 108525",
    "Tecnologia en Gestion de Seguridad y Salud en el Trabajo - 108794",
    "Tecnologia en Gestion de Sistemas Informaticos - 110400",
    "Ingenieria Electrica - 108667",
    "Ingenieria Mecatronica - 108787",
    "Ingenieria Industrial - 108795",
    "Ingenieria de Sistemas - 110399",
  ];

  expectedOptions.forEach((option) => {
    assert.ok(htmlContent.includes(option), `Opcion de carrera no encontrada: ${option}`);
  });

  console.log(`PASS: Todas las ${expectedOptions.length} opciones de carrera estan presentes`);
}

function testSelectStructure() {
  const selectRegex = /<select name="carrera"[^>]*required>\s*<option value="">/;
  assert.ok(selectRegex.test(htmlContent), "El select debe tener required y una opcion vacia por defecto");
  console.log("PASS: Estructura del select es correcta");
}

function testNoInputCarrera() {
  const hasOldInput = htmlContent.includes('name="carrera" type="text"');
  assert.ok(!hasOldInput, "No debe existir un input type text para carrera");
  console.log("PASS: Se removio correctamente el input antiguo");
}

function testTotalOptions() {
  const selectMatch = htmlContent.match(/<select name="carrera"[^>]*>[\s\S]*?<\/select>/);
  assert.ok(selectMatch, "Debe encontrarse el select completo");

  const options = selectMatch[0].match(/<option/g) || [];
  assert.ok(options.length >= 12, `Debe haber al menos 12 opciones (1 vacia + 11 carreras), hay ${options.length}`);
  console.log(`PASS: El select contiene ${options.length} opciones totales`);
}

try {
  console.log("========================================");
  console.log("Tests: Cambio en campo Carrera");
  console.log("========================================\n");

  testCarreraIsSelect();
  testSelectStructure();
  testNoInputCarrera();
  testCarreraOptions();
  testTotalOptions();

  console.log("\n========================================");
  console.log("TODOS LOS TESTS PASARON");
  console.log("========================================");
} catch (error) {
  console.error("\nTEST FALLIDO:");
  console.error(error.message);
  process.exitCode = 1;
}
