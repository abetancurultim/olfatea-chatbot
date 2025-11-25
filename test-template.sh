#!/bin/bash

# Test del endpoint /olfatea/send-template
# Para ejecutar: bash test-template.sh

echo "🧪 Testing WhatsApp Template Endpoint"
echo "======================================"

# URL completa de Firebase
FULL_FIREBASE_URL="https://firebasestorage.googleapis.com/v0/b/coltefinanciera-8a40a.appspot.com/o/images%2Fimage_1763992574415_c13604c6.jpg?alt=media&token=2aa763d1-9828-4558-8d04-b4957c6a7e37"

# Extraer el patch URL (parte después de /o/)
PATCH_URL="o/images%2Fimage_1763992574415_c13604c6.jpg?alt=media&token=2aa763d1-9828-4558-8d04-b4957c6a7e37"

echo ""
echo "📋 Datos de prueba:"
echo "  Dueño: Alejandro"
echo "  Mascota: Lamby"
echo "  Finder: Lisseth"
echo "  Finder Phone: 3146115258"
echo "  Photo URL: $PATCH_URL"
echo ""

curl -X POST http://localhost:3000/olfatea/send-template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+573045655669",
    "templateId": "SIDHX9c9550cf8b2b2173871f1e9b46e022de",
    "ownerName": "Alejandro",
    "petName": "Lamby",
    "finderName": "Lisseth",
    "finderPhone": "3146115258",
    "photoPatchUrl": "'"$PATCH_URL"'",
    "twilioPhoneNumber": "+573052227183"
  }' \
  -w "\n\n📊 HTTP Status: %{http_code}\n" \
  -v

echo ""
echo "======================================"
echo "✅ Test completado"
