#!/bin/bash
# Script de pruebas para los endpoints del backend

BASE_URL="http://localhost:3000"
ADMIN_TOKEN=""
GUARDA_TOKEN=""

set -e

echo "Iniciando pruebas del Backend..."

echo "1) Health"
curl -s -X GET "$BASE_URL/health"
echo ""

echo "2) Login admin"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token')
echo "$ADMIN_LOGIN"

echo "3) Login guarda"
GUARDA_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"guarda","password":"Guarda123!"}')
GUARDA_TOKEN=$(echo "$GUARDA_LOGIN" | jq -r '.token')
echo "$GUARDA_LOGIN"

echo "4) Primer ingreso (GUARDA)"
curl -s -X POST "$BASE_URL/estudiantes/primer-ingreso" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GUARDA_TOKEN" \
  -d '{
    "documento":"102030405",
    "qr_uid":"QR12345",
    "nombre":"Luis Ramon",
    "carrera":"Ingenieria Mecatronica",
    "vigencia":true,
    "placa":"ABC-123",
    "color":"Negro"
  }'
echo ""

echo "5) Registrar movimiento (GUARDA)"
curl -s -X POST "$BASE_URL/movimientos/registrar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GUARDA_TOKEN" \
  -d '{"qr_uid":"QR12345"}'
echo ""

echo "6) Listar movimientos (ADMIN)"
curl -s -X GET "$BASE_URL/movimientos" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo ""

echo "7) Dentro del campus (ADMIN)"
curl -s -X GET "$BASE_URL/movimientos/dentro-campus" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo ""

echo "Pruebas completadas"
