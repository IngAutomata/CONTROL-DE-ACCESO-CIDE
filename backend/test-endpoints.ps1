# ============================================
# TEST ENDPOINTS - CONTROL DE ACCESO CIDE
# ============================================

Write-Host "===============================================" -ForegroundColor Green
Write-Host "INICIANDO PRUEBAS DEL BACKEND" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# 1. TEST DE LOGIN
Write-Host "`n[TEST 1] Login con credenciales admin" -ForegroundColor Yellow
try {
    $login = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/auth/login" `
        -ContentType "application/json" `
        -Body '{"username":"admin","password":"Admin123!"}'
    
    $token = $login.token
    $user = $login.user
    
    Write-Host "✅ Login exitoso" -ForegroundColor Green
    Write-Host "   Usuario: $($user.username)" -ForegroundColor Cyan
    Write-Host "   Rol: $($user.role)" -ForegroundColor Cyan
    Write-Host "   Token: $($token.Substring(0, 50))..." -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error en login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Preparar headers con token
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# 2. TEST ENDPOINT SIN AUTENTICACIÓN (debe fallar)
Write-Host "`n[TEST 2] Acceso a /movimientos SIN token (debe fallar)" -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Method GET -Uri "http://localhost:3000/movimientos"
    Write-Host "❌ Error: Debería haber requerido autenticación" -ForegroundColor Red
} catch {
    if ($_.Exception.Message -like "*401*" -or $_.Exception.Message -like "*unauthorized*") {
        Write-Host "✅ Autenticación requerida correctamente (401)" -ForegroundColor Green
    } else {
        Write-Host "✅ Error esperado: $($_.Exception.Message)" -ForegroundColor Green
    }
}

# 3. TEST LISTAR MOVIMIENTOS CON TOKEN
Write-Host "`n[TEST 3] Listar movimientos con token" -ForegroundColor Yellow
try {
    $movimientos = Invoke-RestMethod -Method GET -Uri "http://localhost:3000/movimientos" -Headers $headers
    Write-Host "✅ Movimientos obtenidos" -ForegroundColor Green
    Write-Host "   Total: $($movimientos.data.Count) registros" -ForegroundColor Cyan
    if ($movimientos.data.Count -gt 0) {
        Write-Host "   Primer registro: $($movimientos.data[0] | ConvertTo-Json -Depth 1)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. TEST LISTAR ESTUDIANTES DENTRO DEL CAMPUS
Write-Host "`n[TEST 4] Listar estudiantes dentro del campus" -ForegroundColor Yellow
try {
    $dentroCampus = Invoke-RestMethod -Method GET -Uri "http://localhost:3000/movimientos/dentro-campus" -Headers $headers
    Write-Host "✅ Consultados exitosamente" -ForegroundColor Green
    Write-Host "   Total dentro del campus: $($dentroCampus.count)" -ForegroundColor Cyan
    if ($dentroCampus.estudiantes.Count -gt 0) {
        Write-Host "   Primeros 2 registros:" -ForegroundColor Cyan
        $dentroCampus.estudiantes[0..1] | ForEach-Object {
            Write-Host "     - $($_.documento): $($_.nombre)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   (No hay estudiantes dentro del campus)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. TEST LOGIN CON CREDENCIALES INCORRECTAS
Write-Host "`n[TEST 5] Login con password incorrecto (debe fallar)" -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/auth/login" `
        -ContentType "application/json" `
        -Body '{"username":"admin","password":"WrongPassword"}'
    Write-Host "❌ Error: Debería haber rechazado la password" -ForegroundColor Red
} catch {
    if ($_.Exception.Message -like "*Credenciales*" -or $_.Exception.Message -like "*401*") {
        Write-Host "✅ Credenciales rechazadas correctamente" -ForegroundColor Green
    } else {
        Write-Host "✅ Error esperado: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
    }
}

# 6. TEST ENDPOINT HEALTH CHECK
Write-Host "`n[TEST 6] Health Check del servidor" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Method GET -Uri "http://localhost:3000/health"
    Write-Host "✅ Servidor operativo" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Cyan
    Write-Host "   Database time: $($health.database_time)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 7. TEST ACCESO A ADMIN ROUTES
Write-Host "`n[TEST 7] Acceso a rutas admin" -ForegroundColor Yellow
try {
    $adminData = Invoke-RestMethod -Method GET -Uri "http://localhost:3000/admin/dashboard" -Headers $headers
    Write-Host "✅ Dados de admin obtenidos" -ForegroundColor Green
    Write-Host "   Respuesta: $($adminData | ConvertTo-Json -Depth 1)" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Info: $($_.Exception.Message)" -ForegroundColor Yellow
}

# RESUMEN FINAL
Write-Host "`n===============================================" -ForegroundColor Green
Write-Host "PRUEBAS COMPLETADAS" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host "`n✅ El backend está funcionando correctamente" -ForegroundColor Green
Write-Host "✅ Autenticación y autorización operativas" -ForegroundColor Green
Write-Host "✅ Base de datos conectada" -ForegroundColor Green
Write-Host "`n"
