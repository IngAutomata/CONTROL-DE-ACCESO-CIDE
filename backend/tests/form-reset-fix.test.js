const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appJsPath = path.resolve(__dirname, "../public/app.js");
const appJsContent = fs.readFileSync(appJsPath, "utf-8");

// Test: Verificar que se usa referencia segura al formulario en lugar de event.currentTarget.reset()
function testFormResetSafety() {
  // Verificar que NO se usa event.currentTarget.reset() directamente
  const dangerousPattern = /event\.currentTarget\.reset\(\)/g;
  const dangerousMatches = appJsContent.match(dangerousPattern);

  assert.ok(!dangerousMatches, `Se encontraron ${dangerousMatches ? dangerousMatches.length : 0} usos peligrosos de event.currentTarget.reset()`);

  // Verificar que se usa una variable local 'form' para reset()
  const safePattern = /const form = event\.currentTarget;\s*[\s\S]*?form\.reset\(\)/g;
  const safeMatches = appJsContent.match(safePattern);

  assert.ok(safeMatches && safeMatches.length >= 2, `Se esperaban al menos 2 usos seguros de form.reset(), se encontraron ${safeMatches ? safeMatches.length : 0}`);

  console.log("✅ PASS: Los formularios usan referencias seguras para reset()");
}

// Test: Verificar que ambos formularios (student-form y user-form) tienen el patrón seguro
function testBothFormsSafe() {
  const studentFormPattern = /document\.getElementById\("student-form"\)\.addEventListener\("submit", async \(event\) => \{[\s\S]*?const form = event\.currentTarget;/g;
  const userFormPattern = /document\.getElementById\("user-form"\)\.addEventListener\("submit", async \(event\) => \{[\s\S]*?const form = event\.currentTarget;/g;

  assert.ok(studentFormPattern.test(appJsContent), "El formulario student-form debe usar referencia segura");
  assert.ok(userFormPattern.test(appJsContent), "El formulario user-form debe usar referencia segura");

  console.log("✅ PASS: Ambos formularios (student-form y user-form) usan referencias seguras");
}

// Test: Verificar que el código del formulario de estudiantes está completo
function testStudentFormComplete() {
  // Verificar que contiene los elementos esenciales directamente en el archivo
  const essentialElements = [
    "const form = event.currentTarget",
    "FormData(form)",
    "form.reset();",
    "printResult"
  ];

  essentialElements.forEach(element => {
    assert.ok(appJsContent.includes(element), `El formulario debe contener: ${element}`);
  });

  console.log("✅ PASS: El formulario de estudiantes está completo y seguro");
}

// Ejecutar tests
try {
  console.log("========================================");
  console.log("Tests: Corrección del Error 'reset()'   ");
  console.log("========================================");
  console.log();

  testFormResetSafety();
  testBothFormsSafe();
  testStudentFormComplete();

  console.log();
  console.log("========================================");
  console.log("✅ TODOS LOS TESTS PASARON");
  console.log("========================================");
  console.log();
  console.log("🎉 El error 'Cannot read properties of null (reading 'reset')' ha sido solucionado!");
  console.log();
  console.log("📋 Cambios realizados:");
  console.log("   • Se cambió event.currentTarget.reset() por form.reset()");
  console.log("   • Se agregó const form = event.currentTarget; al inicio de cada handler");
  console.log("   • Se aplicó la corrección a ambos formularios (student-form y user-form)");
  console.log();
  console.log("🔒 El código ahora es más robusto y evita errores de referencias null");

} catch (error) {
  console.error("\n❌ TEST FALLIDO:");
  console.error(error.message);
  process.exitCode = 1;
}
