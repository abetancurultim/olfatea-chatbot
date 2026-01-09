import { sendPetSightingNotification } from "./utils/functions.js";

async function test() {
  const photoUrl = "https://firebasestorage.googleapis.com/v0/b/coltefinanciera-8a40a.appspot.com/o/images%2F0001perro_mo%C3%B1o.jpg?alt=media&token=77f23cc1-03c3-4cce-9045-a1a5a1395cf0";
  const myPhone = "+573188152674";

  console.log("🚀 Iniciando prueba de notificación...");
  
  try {
    await sendPetSightingNotification(
      myPhone,
      "Andres", // ownerName
      "Moño",   // petName
      "Buscador de Prueba", // finderName
      "+573000000000",      // finderPhone
      photoUrl
    );
    console.log("✅ Prueba finalizada exitosamente");
  } catch (error) {
    console.error("❌ Error en la prueba:", error);
  }
}

test();
