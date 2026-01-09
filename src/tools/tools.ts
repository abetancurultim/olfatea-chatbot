import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  testFunction,
  createPet,
  updateClientProfile,
  createLostPetAlert,
  getOwnerPets,
  getOwnerPetsOptimized,
  getOwnerActiveLostPets,
  getLostPetPhotoByName, // Nueva función para obtener foto de mascota perdida
  updatePet,
  createFoundPetSighting,
  sendPetSightingNotification,
  hasActiveSubscription,
  // Nuevas funciones de planes
  getPlanDetails,
  getAvailablePlans,
  validatePetLimit,
  findPlanByName, // Nueva función para buscar planes por nombre
  getMarketingPrice, // Nueva función para precios de marketing
  // ------
  searchLostPetsFTS,
  // Nuevas funciones de suscripción
  validateCompleteProfile,
  initiateSubscriptionProcess,
  processPaymentProof,
  // Agregar supabase para usar en neighborhood
  supabase,
} from "../utils/functions.js";

// Interfaz para datos básicos de mascota (replicada desde functions.ts)
interface PetData {
  name: string;
  species?: string;
  breed?: string;
  color?: string;
  birth_date?: string;
  gender?: string;
  photo_url?: string;
  distinguishing_marks?: string;
  size?: string; // 🆕 Tamaño: Miniatura, Pequeño, Mediano, Grande, Gigante
  coat_type?: string; // 🆕 Tipo de pelaje: Corto, Medio, Largo, Sin Pelo
}

// 🆕 NUEVO SCHEMA con validaciones flexibles (la IA normaliza según prompt)
const createPetDataSchema = z.object({
  clientNumber: z.string().min(1, "El número de teléfono es obligatorio"),
  name: z.string().min(1, "El nombre de la mascota es OBLIGATORIO"),
  species: z.string().min(1, "La especie es OBLIGATORIA (Perro, Gato, etc.)"),
  breed: z.string().min(1, "La raza específica es OBLIGATORIA"),
  color: z.string().min(1, "El color predominante es OBLIGATORIO"),
  gender: z.string().min(1, "El género es OBLIGATORIO (sugiere: Macho o Hembra)"),
  photo_url: z.string().url("⚠️ La foto es OBLIGATORIA y debe ser una URL válida"),
  size: z.string().min(1, "El tamaño es OBLIGATORIO (sugiere: Miniatura, Pequeño, Mediano, Grande, Gigante)"),
  coat_type: z.string().min(1, "El tipo de pelaje es OBLIGATORIO (sugiere: Corto, Medio, Largo, Sin Pelo)"),
  birth_date: z.string().optional(),
  distinguishing_marks: z.string().min(5, "⚠️ Las marcas distintivas son MUY RECOMENDADAS (mínimo 5 caracteres)").optional(),
});

// Schema antiguo mantenido para compatibilidad (deprecado)
const basicPetDataSchema = z.object({
  clientNumber: z.string().min(1, "El número de teléfono es obligatorio"),
  name: z.string().min(1, "El nombre de la mascota es obligatorio"),
  species: z.string().optional(),
  breed: z.string().optional(),
  gender: z.string().optional(),
  photo_url: z.string().url("La URL de la foto debe ser válida").optional(),
});

// Esquema Zod para validación de datos del perfil del cliente
const updateProfileSchema = z.object({
  phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
  fullName: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

// Esquema Zod para validación de datos de alerta de mascota perdida
const lostPetAlertSchema = z.object({
  phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
  petName: z.string().optional(),
  lastSeenAt: z
    .string()
    .min(1, "La fecha y hora de la última vez vista es obligatoria"),
  lastSeenDescription: z.string().optional(),
  lastSeenLocation: z.string().optional(),
  lastSeenCity: z.string().min(1, "La ciudad donde se perdió es OBLIGATORIA"),
  lastSeenCountry: z.string().min(1, "El país donde se perdió es OBLIGATORIO"),
  additionalInfo: z.string().optional(),
});

// Esquema Zod para validación de actualización de mascota
const updatePetSchema = z.object({
  phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
  petIdentifier: z.string().min(1, "El identificador de la mascota (ID o nombre) es obligatorio"),
  name: z.string().optional(),
  species: z.string().optional(),
  breed: z.string().optional(),
  color: z.string().optional(),
  birth_date: z.string().optional(),
  gender: z.string().optional(),
  photo_url: z.string().url("La URL de la foto debe ser válida").optional(),
  distinguishing_marks: z.string().optional(),
});

// Tool de prueba
export const testTool = tool(
  async () => {
    const results = await testFunction();
    return results;
  },
  {
    name: "testTool",
    description: "Tool de prueba",
  }
);

export const checkSubscriptionStatusTool = tool(
  async ({ phoneNumber }) => {
    const subscriptionStatus = await hasActiveSubscription(phoneNumber);
    
    if (subscriptionStatus.active) {
      // Mostrar TODAS las suscripciones activas del usuario
      let subscriptionsMessage = `✅ SUSCRIPCIÓN ACTIVA\n\n`;
      
      if (subscriptionStatus.subscriptions.length > 0) {
        subscriptionsMessage += `📋 Planes activos (${subscriptionStatus.subscriptions.length}):\n\n`;
        
        subscriptionStatus.subscriptions.forEach((sub, index) => {
          const planName = sub.plan?.name || 'Plan desconocido';
          const petLimit = sub.plan?.pet_limit || 0;
          const price = sub.plan?.price || 0;
          const expiresAt = sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('es-CO') : 'No especificado';
          
          const limitText = petLimit >= 999 ? 'ilimitadas' : `${petLimit} mascota${petLimit !== 1 ? 's' : ''}`;
          
          subscriptionsMessage += `${index + 1}. 🐾 ${planName}\n`;
          subscriptionsMessage += `   • Límite: ${limitText}\n`;
          subscriptionsMessage += `   • Precio: ${price.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}\n`;
          subscriptionsMessage += `   • Expira: ${expiresAt}\n\n`;
        });
        
        subscriptionsMessage += `📊 RESUMEN:\n`;
        subscriptionsMessage += `• Límite total: ${subscriptionStatus.totalPetLimit >= 999 ? 'ilimitado' : subscriptionStatus.totalPetLimit} mascota${subscriptionStatus.totalPetLimit !== 1 ? 's' : ''}\n`;
        subscriptionsMessage += `• Mascotas registradas: ${subscriptionStatus.currentPetCount}\n`;
        
        const canRegister = subscriptionStatus.totalPetLimit >= 999 || subscriptionStatus.currentPetCount < subscriptionStatus.totalPetLimit;
        const remaining = subscriptionStatus.totalPetLimit >= 999 ? '∞' : (subscriptionStatus.totalPetLimit - subscriptionStatus.currentPetCount);
        
        if (canRegister) {
          subscriptionsMessage += `✅ Puede registrar ${remaining === '∞' ? 'más mascotas (ilimitado)' : `${remaining} mascota(s) más`}\n`;
        } else {
          subscriptionsMessage += `⚠️ Ha alcanzado el límite total de sus planes\n`;
        }
      }
      
      return subscriptionsMessage;
    } else {
      // Determinar el mensaje específico según el estado
      let message = "";
      let actionRequired = "";
      
      switch (subscriptionStatus.status) {
        case 'expired':
          message = `❌ SUSCRIPCIÓN EXPIRADA: ${subscriptionStatus.reason}`;
          actionRequired = "Debe renovar su suscripción para continuar registrando mascotas.";
          break;
        case 'none':
          if (subscriptionStatus.reason?.includes('no encontrado')) {
            message = `❌ PERFIL NO ENCONTRADO: ${subscriptionStatus.reason}`;
            actionRequired = "Debe registrarse y adquirir un plan de suscripción.";
          } else {
            message = `❌ SIN SUSCRIPCIÓN: ${subscriptionStatus.reason}`;
            actionRequired = "Debe adquirir un plan de suscripción para registrar mascotas.";
          }
          break;
        default:
          message = `❌ PROBLEMA CON SUSCRIPCIÓN: ${subscriptionStatus.reason}`;
          actionRequired = "Contacte soporte para resolver el problema con su suscripción.";
      }
      
      return `${message}\n\n🚫 NO PUEDE REGISTRAR MASCOTAS.\n📞 ${actionRequired}\n\n💡 Una vez que tenga suscripción activa, podrá registrar mascotas según el plan que elija.`;
    }
  },
  {
    name: "checkSubscriptionStatusTool",
    description: "HERRAMIENTA CRÍTICA: Verifica si un usuario tiene suscripciones activas y muestra información detallada de TODOS sus planes (límites de mascotas, mascotas registradas, fechas de expiración). DEBE usarse SIEMPRE antes de crear o modificar mascotas para evitar desperdiciar el tiempo del usuario.",
    schema: z.object({
      phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
  }
);

export const createPetTool = tool(
  async ({ clientNumber, name, species, breed, color, gender, photo_url, size, coat_type, birth_date, distinguishing_marks }) => {
    
    // 🆕 VALIDACIÓN ADICIONAL de URL
    try {
      new URL(photo_url.trim());
    } catch (error) {
      return "❌ ERROR: La URL de la foto no es válida. Debe ser una URL completa (ej: https://ejemplo.com/imagen.jpg).";
    }

    // Crear objeto PetData con TODOS los campos obligatorios
    const petData: PetData = {
      name: name.trim(),
      species: species.trim(),
      breed: breed.trim(),
      color: color.trim(),
      gender: gender.trim(),
      photo_url: photo_url.trim(),
      size: size.trim(),
      coat_type: coat_type.trim(),
      birth_date: birth_date?.trim() || undefined,
      distinguishing_marks: distinguishing_marks?.trim() || undefined,
    };

    const result = await createPet(clientNumber, petData);

    if (result.success) {
      let successMessage = `✅ ¡Mascota registrada exitosamente!

🐾 **${petData.name}**
• Especie: ${petData.species}
• Raza: ${petData.breed}
• Color: ${petData.color}
• Género: ${petData.gender}
• Tamaño: ${petData.size}
• Pelaje: ${petData.coat_type}
• Foto: ${petData.photo_url}`;

      if (petData.birth_date) {
        successMessage += `\n• Fecha de nacimiento: ${petData.birth_date}`;
      }

      if (petData.distinguishing_marks) {
        successMessage += `\n• Marcas distintivas: ${petData.distinguishing_marks}`;
      } else {
        successMessage += `\n\n⚠️ RECOMENDACIÓN: Considera agregar marcas distintivas únicas (cicatrices, manchas especiales, etc.) usando updatePetTool. Esto aumenta mucho las posibilidades de encontrar a tu mascota si se pierde.`;
      }

      return successMessage;
    } else {
      return `❌ ${result.error?.message || 'Error desconocido al crear la mascota'}`;
    }
  },
  {
    name: "createPetTool",
    description: `🆕 ACTUALIZADO: Registra una mascota con TODOS los datos OBLIGATORIOS para maximizar posibilidades de encontrarla si se pierde.

📋 CAMPOS OBLIGATORIOS (NO CREAR SIN ESTOS):
• name - Nombre de la mascota
• species - Especie (Perro, Gato, etc.)
• breed - Raza específica
• color - Color predominante
• gender - Género. NORMALIZA: "macho/hembra/masculino/femenino" → "Macho" o "Hembra"
• photo_url - URL de foto CLARA de la mascota
• size - Tamaño. NORMALIZA respuestas como "pequeñito/chico/grandote" → "Miniatura", "Pequeño", "Mediano", "Grande" o "Gigante"
• coat_type - Tipo de pelaje. NORMALIZA: "peludo/sin pelo/cortico" → "Corto", "Medio", "Largo" o "Sin Pelo"

📸 ALTAMENTE RECOMENDADO:
• distinguishing_marks - Marcas distintivas únicas (cicatrices, manchas, etc.)
• birth_date - Fecha de nacimiento

⚠️ IMPORTANTE: Interpreta y normaliza las respuestas naturales del usuario a los valores estándar antes de llamar al tool.`,
    schema: createPetDataSchema,
  }
);

export const updateProfileTool = tool(
  async ({ phoneNumber, fullName, email, city, country }) => {
    // Validar que al menos un campo adicional sea proporcionado
    if (!fullName && !email && !city && !country) {
      return "Error: Debe proporcionar al menos un campo para actualizar (nombre completo, email, ciudad o país).";
    }

    // Validar formato de email si se proporciona
    if (email && email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return "Error: El formato del email no es válido.";
      }
    }

    const result = await updateClientProfile(
      phoneNumber,
      fullName || undefined,
      email || undefined,
      city || undefined,
      country || undefined
    );

    if (result) {
      return result;
    } else {
      return "Error: No se pudo actualizar el perfil. Verifique que el número de teléfono sea correcto y que el perfil exista.";
    }
  },
  {
    name: "updateProfileTool",
    description:
      "Actualiza los datos del perfil de un cliente existente por número de teléfono. Permite actualizar nombre completo, email, ciudad y país. Al menos un campo debe ser proporcionado para realizar la actualización.",
    schema: updateProfileSchema,
  }
);

export const createLostPetAlertTool = tool(
  async ({
    phoneNumber,
    petName,
    lastSeenAt,
    lastSeenDescription,
    lastSeenLocation,
    lastSeenCity,
    lastSeenCountry,
    additionalInfo,
  }) => {
    // Validar formato de fecha básico
    if (lastSeenAt && lastSeenAt.trim() !== "") {
      const dateTest = new Date(lastSeenAt.trim());
      if (isNaN(dateTest.getTime())) {
        return "Error: El formato de la fecha no es válido. Use formato ISO (ej: 2024-01-15T10:30:00Z) o un formato reconocible.";
      }
    }

    // Combinar ubicación completa incluyendo ciudad y país
    const fullLocation = [
      lastSeenLocation?.trim(),
      lastSeenCity?.trim(),
      lastSeenCountry?.trim()
    ].filter(Boolean).join(", ");

    const alertData = {
      last_seen_at: lastSeenAt.trim(),
      last_seen_description: lastSeenDescription?.trim() || undefined,
      last_seen_location: fullLocation,
      additional_info: additionalInfo?.trim() || undefined,
    };

    const result = await createLostPetAlert(
      phoneNumber,
      alertData,
      undefined, // petId ya no se usa como parámetro principal
      petName?.trim() || undefined
    );

    if (result) {
      return result;
    } else {
      return "Error: No se pudo crear la alerta de mascota perdida. Verifique los datos proporcionados.";
    }
  },
  {
    name: "createLostPetAlertTool",
    description:
      "Crea una alerta de mascota perdida para un propietario por número de teléfono. Requiere OBLIGATORIAMENTE: fecha/hora de última vez vista, ciudad y país donde se perdió. Si el propietario tiene múltiples mascotas, debe especificar el nombre de la mascota. Los campos de descripción, ubicación específica e información adicional son opcionales.",
    schema: lostPetAlertSchema,
  }
);

export const getOwnerPetsTool = tool(
  async ({ phoneNumber }) => {
    const pets = await getOwnerPets(phoneNumber);

    if (!pets) {
      return "Error: No se pudo obtener la información del propietario o no tiene mascotas registradas.";
    }

    if (pets.length === 0) {
      return "El propietario no tiene mascotas registradas.";
    }

    const petList = pets
      .map((pet) => {
        const lostStatus = pet.is_currently_lost ? " (PERDIDA)" : "";
        const photoInfo = pet.photo_url ? `\n  Foto: ${pet.photo_url}` : "";
        return `- ${pet.name}${lostStatus}\n  Especie: ${
          pet.species || "No especificada"
        }\n  Raza: ${pet.breed || "No especificada"}\n  Género: ${
          pet.gender || "No especificado"
        }${photoInfo}`;
      })
      .join("\n\n");

    return `Mascotas registradas para este propietario:\n\n${petList}`;
  },
  {
    name: "getOwnerPetsTool",
    description:
      "Obtiene la lista de mascotas registradas para un propietario por número de teléfono. Útil para ver las mascotas disponibles antes de crear una alerta de pérdida o para actualizar información.",
    schema: z.object({
      phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
  }
);

export const getOwnerPetsOptimizedTool = tool(
  async ({ phoneNumber }) => {
    const pets = await getOwnerPetsOptimized(phoneNumber);

    if (!pets) {
      return "Error: No se pudo obtener la información del propietario o no tiene mascotas registradas.";
    }

    if (pets.length === 0) {
      return "El propietario no tiene mascotas registradas.";
    }

    const petList = pets
      .map((pet) => {
        const alertStatus = pet.has_active_alert ? " (🚨 ALERTA ACTIVA)" : "";
        const lastSeenInfo = pet.last_seen_at ? `\n  Última vez vista: ${new Date(pet.last_seen_at).toLocaleString()}` : "";
        const photoInfo = pet.photo_url ? `\n  Foto: ${pet.photo_url}` : "";
        return `- ${pet.name}${alertStatus}\n  Especie: ${
          pet.species || "No especificada"
        }\n  Raza: ${pet.breed || "No especificada"}\n  Género: ${
          pet.gender || "No especificado"
        }${lastSeenInfo}${photoInfo}`;
      })
      .join("\n\n");

    return `Mascotas registradas para este propietario:\n\n${petList}`;
  },
  {
    name: "getOwnerPetsOptimizedTool",
    description:
      "Versión optimizada que obtiene la lista de mascotas de un propietario incluyendo información de alertas activas. Más eficiente para mostrar el estado actual de las mascotas.",
    schema: z.object({
      phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
  }
);

export const getOwnerActiveLostPetsTool = tool(
  async ({ phoneNumber }) => {
    const activePets = await getOwnerActiveLostPets(phoneNumber);

    if (!activePets) {
      return "Error: No se pudo obtener la información de alertas activas.";
    }

    if (activePets.length === 0) {
      return "El propietario no tiene mascotas con alertas activas en este momento.";
    }

    const petList = activePets
      .map((pet) => {
        const photoInfo = pet.pet_photo_url ? `\n  Foto: ${pet.pet_photo_url}` : "";
        const marksInfo = pet.distinguishing_marks ? `\n  Marcas distintivas: ${pet.distinguishing_marks}` : "";
        const lastSeenInfo = pet.last_seen_at ? `\n  Última vez vista: ${new Date(pet.last_seen_at).toLocaleString()}` : "";
        const locationInfo = pet.last_seen_description ? `\n  Descripción del lugar: ${pet.last_seen_description}` : "";
        const notesInfo = pet.alert_notes ? `\n  Notas adicionales: ${pet.alert_notes}` : "";
        
        return `🚨 ${pet.pet_name}\n  Especie: ${
          pet.species || "No especificada"
        }\n  Raza: ${pet.breed || "No especificada"}\n  Color: ${
          pet.color || "No especificado"
        }\n  Género: ${
          pet.gender || "No especificado"
        }${marksInfo}${photoInfo}${lastSeenInfo}${locationInfo}${notesInfo}`;
      })
      .join("\n\n");

    return `🔍 Mascotas con alertas activas:\n\n${petList}`;
  },
  {
    name: "getOwnerActiveLostPetsTool",
    description:
      "Obtiene únicamente las mascotas con alertas activas de un propietario, con información completa de la alerta. Ideal para consultas rápidas sobre mascotas perdidas.",
    schema: z.object({
      phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
  }
);

export const updatePetTool = tool(
  async ({
    phoneNumber,
    petIdentifier,
    name,
    species,
    breed,
    color,
    birth_date,
    gender,
    photo_url,
    distinguishing_marks,
  }) => {
    // Validar que al menos un campo sea proporcionado para actualizar
    const fieldsProvided = [
      name,
      species,
      breed,
      color,
      birth_date,
      gender,
      photo_url,
      distinguishing_marks,
    ].filter(field => field !== undefined && field !== null && field !== "");

    if (fieldsProvided.length === 0) {
      return "Error: Debe proporcionar al menos un campo para actualizar (nombre, especie, raza, color, fecha de nacimiento, género, URL de foto o marcas distintivas).";
    }

    // Validar formato de URL si se proporciona
    if (photo_url && photo_url.trim() !== "") {
      try {
        new URL(photo_url.trim());
      } catch (error) {
        return "Error: La URL de la foto no es válida. Debe ser una URL completa (ej: https://ejemplo.com/imagen.jpg).";
      }
    }

    // Preparar los datos para actualizar
    const petData: Partial<PetData> = {};
    if (name) petData.name = name;
    if (species) petData.species = species;
    if (breed) petData.breed = breed;
    if (color) petData.color = color;
    if (birth_date) petData.birth_date = birth_date;
    if (gender) petData.gender = gender;
    if (photo_url) petData.photo_url = photo_url;
    if (distinguishing_marks) petData.distinguishing_marks = distinguishing_marks;

    const result = await updatePet(phoneNumber, petIdentifier, petData);

    if (result) {
      return result;
    } else {
      return "Error: No se pudo actualizar la mascota. Verifique que el número de teléfono sea correcto, que la mascota exista y que los datos proporcionados sean válidos.";
    }
  },
  {
    name: "updatePetTool",
    description:
      "Actualiza los datos de una mascota existente. Permite actualizar nombre, especie, raza, color, fecha de nacimiento, género, URL de foto y marcas distintivas. La mascota se identifica por su ID o nombre. Al menos un campo debe ser proporcionado para realizar la actualización.",
    schema: updatePetSchema,
  }
);

// 🆕 NUEVO SCHEMA con foto OBLIGATORIA y descripción detallada
const createFoundPetSightingSchema = z.object({
  finderPhone: z.string().min(1, "El número de teléfono de quien encontró la mascota es obligatorio"),
  finderName: z.string().min(1, "El nombre de quien encontró la mascota es obligatorio"),
  petDescription: z.string().min(20, "⚠️ La descripción debe ser DETALLADA (mínimo 20 caracteres). Incluye: especie, tamaño, color, pelaje, marcas distintivas."),
  locationFound: z.string().min(10, "La ubicación debe ser específica (mínimo 10 caracteres)"),
  cityFound: z.string().min(1, "La ciudad donde se encontró es OBLIGATORIA"),
  countryFound: z.string().min(1, "El país donde se encontró es OBLIGATORIO"),
  photoUrl: z.string().url("⚠️ La FOTO es OBLIGATORIA y debe ser una URL válida. Sin foto es muy difícil hacer match."), // 🆕 YA NO OPCIONAL
  alertId: z.string().optional(),
});

export const createFoundPetSightingTool = tool(
  async ({ finderPhone, finderName, petDescription, locationFound, cityFound, countryFound, photoUrl, alertId }) => {
    
    // 🆕 VALIDACIÓN ESTRICTA de foto (OBLIGATORIA según nueva política)
    if (!photoUrl || photoUrl.trim() === "") {
      return `❌ ERROR CRÍTICO: La foto de la mascota encontrada es OBLIGATORIA.

📸 NUEVA POLÍTICA: Es obligatorio tomar y enviar una foto clara de la mascota encontrada para poder notificar al posible dueño.

🎯 La foto se enviará automáticamente al dueño dentro del mensaje de WhatsApp para confirmar que es su mascota.

Por favor, pide al usuario que tome una foto clara de la mascota y la comparta antes de continuar con el reporte.`;
    }

    try {
      new URL(photoUrl.trim());
    } catch (error) {
      return "❌ ERROR: La URL de la foto no es válida. Debe ser una URL completa.";
    }

    // Combinar ubicación completa incluyendo ciudad y país
    const fullLocation = [
      locationFound?.trim(),
      cityFound?.trim(),
      countryFound?.trim()
    ].filter(Boolean).join(", ");

    const result = await createFoundPetSighting(
      finderPhone,
      finderName,
      petDescription,
      fullLocation,
      photoUrl.trim(), // Ahora SIEMPRE se envía
      alertId || undefined
    );

    if (result) {
      // Si es solo un avistamiento sin match
      if (!result.isMatch) {
        return `✅ Avistamiento registrado exitosamente en ${cityFound}, ${countryFound}. 

📋 ID del avistamiento: ${result.sightingId}
📸 Foto incluida: ${photoUrl}

Este reporte quedará disponible para futuras alertas que coincidan. Si hay una mascota reportada como perdida que encaje con esta descripción, el dueño será notificado automáticamente.`;
      }
      
      // Si es un match confirmado
      const notificationStatus = result.notificationSent 
        ? "✅ Notificación enviada exitosamente via WhatsApp!" 
        : `⚠️ Error enviando notificación: ${result.notificationError}`;
      
      // Validar que tenemos la información necesaria para mostrar el match
      if (!result.pet || !result.owner) {
        return `Error: No se pudo obtener la información completa del match. ID del avistamiento: ${result.sightingId}`;
      }
      
      const detailedMessage = `
🎉 ¡MASCOTA ENCONTRADA Y MATCH CONFIRMADO! 

${result.pet.name} (${result.pet.species || 'mascota'} ${result.pet.breed || ''}) ha sido encontrada.

👤 DUEÑO:
- Nombre: ${result.owner.name}
- Teléfono: ${result.owner.phone}

🔍 PERSONA QUE LA ENCONTRÓ:
- Nombre: ${result.finder.name}  
- Teléfono: ${result.finder.phone}
- Ubicación: ${result.finder.location}
- Descripción: ${result.finder.description}
- Foto: ${result.finder.photoUrl}

📱 Estado de notificación: ${notificationStatus}

El match ha sido confirmado automáticamente y ambas partes pueden contactarse directamente.
      `.trim();

      return detailedMessage;
    } else {
      return "❌ Error: No se pudo registrar el avistamiento de la mascota encontrada. Verifique los datos proporcionados.";
    }
  },
  {
    name: "createFoundPetSightingTool",
    description: `Registra avistamientos de mascotas encontradas. Procesa el reporte con la información disponible.

📋 CAMPOS OBLIGATORIOS (sin estos NO funciona):
• finderPhone - Teléfono de quien encontró (requerido)
• finderName - Nombre de quien encontró (requerido)
• locationFound - Ubicación específica donde se encontró (requerido)
• cityFound - Ciudad (requerido)
• countryFound - País (requerido)
• photoUrl - URL de la foto de la mascota (OBLIGATORIA)

📝 CAMPO DE DESCRIPCIÓN:
• petDescription - Descripción de la mascota (mínimo 20 caracteres)
  SUGERENCIAS para mejor match (pide estos datos si faltan, pero NO bloquees el reporte):
  - Especie (perro, gato, etc.)
  - Color(es) predominante(s)
  - Tamaño aproximado
  - Tipo de pelaje
  - Marcas distintivas (collar, manchas, cicatrices)

🎯 OPCIONAL (mejora el match):
• alertId - ID de alerta si ya confirmó match con una mascota específica

💡 ESTRATEGIA: Pide la información sugerida conversacionalmente, pero si el usuario ya dio suficiente información (aunque no sea perfecta), procede con el reporte. La foto + descripción básica es suficiente para crear el avistamiento.`,
    schema: createFoundPetSightingSchema,
  }
);

//! Prueba de consulta con Supabase Function
// Esquema Zod para la nueva herramienta de búsqueda
const findLostPetsSchema = z.object({
  description: z
    .string()
    .min(5, "La descripción debe tener al menos 5 caracteres para ser efectiva."),
});

// --- LA NUEVA HERRAMIENTA ---

export const findLostPetsTool = tool(
  async ({ description }) => {
    // 1. Llamar a la función de utilidad que habla con Supabase
    const searchResult = await searchLostPetsFTS(description);

    // 2. Manejar los posibles errores o casos sin resultados
    if (searchResult.error) {
      return searchResult.error;
    }

    if (searchResult.results.length === 0) {
      return "No se encontraron mascotas perdidas que coincidan con la descripción proporcionada. Agradécele al usuario por su ayuda de todas formas.";
    }

    // 3. Formatear el resultado JSON en un string claro para la IA
    //    Esta es la parte clave para solucionar el problema de contexto.
    const formattedResults = searchResult.results.map((pet: any, index: number) => {
        const ownerLocation = [pet.owner_neighborhood, pet.owner_city, pet.owner_country]
            .filter(Boolean) // Elimina nulos o vacíos
            .join(', ');

        return `
        Resultado ${index + 1} (Relevancia: ${Math.round(pet.rank * 100)}%):
        - ID de Alerta: ${pet.alert_id}
        - Nombre de Mascota: ${pet.pet_name}
        - Descripción de Mascota: ${pet.species || ''} ${pet.breed || ''} de color ${pet.color || 'no especificado'}.
        - Señas Particulares: ${pet.distinguishing_marks || 'Ninguna.'}
        - Info de la Pérdida: Fue visto por última vez en "${pet.last_seen_description || 'no especificado'}".
        - Dueño: ${pet.owner_name || 'No especificado'}.
        - Ubicación del Dueño: ${ownerLocation || 'No especificada'}.
        - Teléfono de Contacto del Dueño: ${pet.owner_phone}.
        `;
    }).join('\n---\n');

    return `Se encontraron las siguientes mascotas perdidas. Presenta un resumen numerado al usuario y pídele que confirme si alguna coincide. **Guarda toda esta información para responder preguntas de seguimiento**:\n${formattedResults}`;
  },
  {
    name: "find_lost_pets_by_description",
    description:
      "DEBES usar esta herramienta cuando un usuario te informa que ha encontrado una mascota y te da una descripción de ella. La entrada debe ser un texto detallado que describa la mascota y la ubicación donde fue encontrada (ej: 'gato tricolor con collar rojo en el parque de Belén'). La herramienta buscará en la base de datos y devolverá las coincidencias más probables con toda su información.",
    schema: findLostPetsSchema,
  }
);

//! ================== HERRAMIENTAS DE SUSCRIPCIÓN ==================

// Esquema Zod para validar perfil completo
const validateCompleteProfileSchema = z.object({
  phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
});

// Esquema Zod para actualizar perfil completo (incluyendo neighborhood)
const updateCompleteProfileSchema = z.object({
  phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
  fullName: z.string().optional(),
  email: z.string().email("Formato de email inválido").optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  neighborhood: z.string().optional(),
});

// Esquema Zod para procesar comprobante de pago
const processPaymentProofSchema = z.object({
  phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
  proofImageUrl: z.string().url("La URL debe ser válida").min(1, "La URL es obligatoria"),
  planIdentifier: z.string().optional().describe("El nombre del plan (ej: 'Huellita', 'Plan 1') SI el usuario lo menciona o si se necesita reintentar la activación.")
});

export const validateCompleteProfileTool = tool(
  async ({ phoneNumber }) => {
    const result = await validateCompleteProfile(phoneNumber);

    if (!result.profile) {
      return "❌ No se encontró un perfil para este número de teléfono. Primero necesitas registrarte en el sistema.";
    }

    if (result.isComplete) {
      return `✅ ¡Perfecto! Tu perfil está completo y listo para la suscripción:
      
📋 **Información Registrada:**
• **Nombre:** ${result.profile.full_name}
• **Email:** ${result.profile.email}
• **Ciudad:** ${result.profile.city}
• **País:** ${result.profile.country}  
• **Barrio:** ${result.profile.neighborhood}
• **Teléfono:** ${result.profile.phone_number}

Ya puedes proceder con el proceso de suscripción.`;
    } else {
      const fieldNames: { [key: string]: string } = {
        full_name: "Nombre completo",
        email: "Email",
        city: "Ciudad",
        country: "País", 
        neighborhood: "Barrio"
      };
      
      const missingFieldsText = result.missingFields
        .map(field => `• ${fieldNames[field] || field}`)
        .join("\n");

      return `⚠️ Tu perfil está incompleto. Para suscribirte a Olfatea necesitas completar los siguientes datos:

${missingFieldsText}

¿Podrías proporcionarme esta información para completar tu perfil?`;
    }
  },
  {
    name: "validateCompleteProfileTool",
    description: "Verifica si el perfil de un usuario está completo con todos los datos requeridos para la suscripción (nombre, email, ciudad, país, barrio). Usar antes de iniciar proceso de suscripción.",
    schema: validateCompleteProfileSchema,
  }
);

export const updateCompleteProfileTool = tool(
  async ({ phoneNumber, fullName, email, city, country, neighborhood }) => {
    // Validar que al menos un campo adicional sea proporcionado
    const fieldsProvided = [fullName, email, city, country, neighborhood].filter(
      field => field !== undefined && field !== null && field !== ""
    );

    if (fieldsProvided.length === 0) {
      return "❌ Debes proporcionar al menos un campo para actualizar tu perfil.";
    }

    // Usar la función updateClientProfile existente que acepta city y country,
    // pero necesitamos extenderla para neighborhood
    try {
      console.log(`🔄 Actualizando perfil para: ${phoneNumber}`);
      
      // Primero, actualizar los campos básicos que ya están soportados
      if (fullName || email || city || country) {
        console.log(`📝 Actualizando campos básicos: fullName=${!!fullName}, email=${!!email}, city=${!!city}, country=${!!country}`);
        
        const basicResult = await updateClientProfile(
          phoneNumber,
          fullName || undefined,
          email || undefined,
          city || undefined,
          country || undefined
        );

        console.log(`✅ Resultado actualización básica:`, basicResult);

        if (!basicResult) {
          console.log(`❌ Error: basicResult es null o falso`);
          return "❌ Error actualizando los datos básicos del perfil.";
        }
      }

      // Si hay neighborhood, actualizarlo por separado
      if (neighborhood && neighborhood.trim() !== "") {
        console.log(`🏠 Actualizando neighborhood: ${neighborhood}`);
        
        // Buscar el perfil por teléfono
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone_number", phoneNumber)
          .maybeSingle();

        if (profileError || !profile) {
          console.log(`❌ Error encontrando perfil para neighborhood:`, profileError);
          return "❌ Error encontrando el perfil para actualizar el barrio.";
        }

        // Actualizar neighborhood
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ neighborhood: neighborhood.trim() })
          .eq("id", profile.id);

        if (updateError) {
          console.log(`❌ Error actualizando neighborhood:`, updateError);
          return "❌ Error actualizando el barrio en el perfil.";
        }
        
        console.log(`✅ Neighborhood actualizado exitosamente`);
      }

      console.log(`🔍 Validando perfil completo...`);
      
      // Verificar si el perfil quedó completo
      const validation = await validateCompleteProfile(phoneNumber);
      
      console.log(`📊 Resultado validación:`, validation);
      
      if (validation.isComplete) {
        console.log(`✅ Perfil completo!`);
        return `✅ ¡Perfecto! Tu perfil ha sido actualizado y ahora está completo:

📋 **Información Actualizada:**
• **Nombre:** ${validation.profile?.full_name}
• **Email:** ${validation.profile?.email}
• **Ciudad:** ${validation.profile?.city}
• **País:** ${validation.profile?.country}  
• **Barrio:** ${validation.profile?.neighborhood}

Ya puedes proceder con la suscripción.`;
      } else {
        console.log(`⚠️ Perfil incompleto, faltan campos:`, validation.missingFields);
        
        const fieldNames: { [key: string]: string } = {
          full_name: "Nombre completo",
          email: "Email", 
          city: "Ciudad",
          country: "País",
          neighborhood: "Barrio"
        };
        
        const missingFieldsText = validation.missingFields
          .map(field => `• ${fieldNames[field] || field}`)
          .join("\n");

        return `✅ Perfil actualizado, pero aún faltan algunos datos:

${missingFieldsText}

¿Podrías proporcionar estos datos faltantes?`;
      }

    } catch (error) {
      console.error(`❌ Error en updateCompleteProfileTool:`, error);
      return `❌ Error actualizando el perfil: ${error}`;
    }
  },
  {
    name: "updateCompleteProfileTool",
    description: "Actualiza el perfil del usuario con todos los datos necesarios para la suscripción, incluyendo nombre, email, ciudad, país y barrio. Extensión de updateProfileTool que incluye neighborhood.",
    schema: updateCompleteProfileSchema,
  }
);

export const findPlanByNameTool = tool(
  async ({ planName }) => {
    const plan = await findPlanByName(planName);
    
    if (!plan) {
      const availablePlans = await getAvailablePlans();
      let plansList = "📋 **PLANES DISPONIBLES:**\n\n";
      
      availablePlans.forEach((availablePlan, index) => {
        const petLimitText = availablePlan.pet_limit >= 999 
          ? "mascotas ilimitadas" 
          : `${availablePlan.pet_limit} mascota${availablePlan.pet_limit > 1 ? 's' : ''}`;
        const priceText = availablePlan.price.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        
        plansList += `${index + 1}. **${availablePlan.name}:** ${priceText}/año (${petLimitText})\n`;
      });
      
      return `❌ No se encontró el plan "${planName}". \n\n${plansList}\n\nPor favor, especifica el nombre exacto del plan que te interesa.`;
    }

    const petLimitText = plan.pet_limit >= 999 
      ? "mascotas ilimitadas" 
      : `${plan.pet_limit} mascota${plan.pet_limit > 1 ? 's' : ''}`;
    const priceText = plan.price.toLocaleString('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0 
    });

    return `✅ **Plan encontrado:**

📋 **${plan.name}**
💰 **Precio:** ${priceText}/año
🐾 **Límite:** ${petLimitText}
⏱️ **Duración:** ${plan.duration_months} meses

**ID del plan:** ${plan.id}

Para suscribirte a este plan, confirma y te daré los datos para el pago.`;
  },
  {
    name: "findPlanByNameTool",
    description: "Busca un plan específico por nombre o identificador (acepta nombres parciales, números de plan, etc.). Útil cuando el usuario menciona un plan específico como 'huellita', 'plan 1', 'doble huella', etc.",
    schema: z.object({
      planName: z.string().min(1, "El nombre o identificador del plan es obligatorio"),
    }),
  }
);

export const initiateSubscriptionTool = tool(
  async ({ phoneNumber, planIdentifier }) => {
    // Primero, intentar encontrar el plan por nombre o ID
    let planDetails;
    
    // Si parece ser un UUID, usar getPlanDetails directamente
    if (planIdentifier.length > 20 && planIdentifier.includes('-')) {
      planDetails = await getPlanDetails(planIdentifier);
    } else {
      // Si es un nombre o identificador corto, usar findPlanByName
      planDetails = await findPlanByName(planIdentifier);
    }
    
    if (!planDetails) {
      const availablePlans = await getAvailablePlans();
      let plansList = "📋 **PLANES DISPONIBLES:**\n\n";
      
      availablePlans.forEach((plan: any, index: number) => {
        const petLimitText = plan.pet_limit >= 999 
          ? "mascotas ilimitadas" 
          : `${plan.pet_limit} mascota${plan.pet_limit > 1 ? 's' : ''}`;
        
        // Mostrar con descuento si aplica
        if (plan.hasDiscount) {
          const formattedMarketingPrice = plan.marketingPrice.toLocaleString('es-CO', { 
            style: 'currency', 
            currency: 'COP',
            minimumFractionDigits: 0 
          });
          const formattedRealPrice = plan.price.toLocaleString('es-CO', { 
            style: 'currency', 
            currency: 'COP',
            minimumFractionDigits: 0 
          });
          plansList += `${index + 1}. **${plan.name}:** ~~${formattedMarketingPrice}~~ ${formattedRealPrice}/año (${petLimitText}) 🎁\n`;
        } else {
          const priceText = plan.price.toLocaleString('es-CO', { 
            style: 'currency', 
            currency: 'COP',
            minimumFractionDigits: 0 
          });
          plansList += `${index + 1}. **${plan.name}:** ${priceText}/año (${petLimitText})\n`;
        }
      });
      
      return `❌ No se encontró el plan "${planIdentifier}". \n\n${plansList}\n\nPor favor, especifica el nombre exacto del plan que te interesa.`;
    }

    // Ahora usar el ID correcto del plan encontrado
    const result = await initiateSubscriptionProcess(phoneNumber, planDetails.id);

    if (!result.success) {
      return result.message;
    }

    const planInfo = result.planSelected;
    let planDescription = '';
    let promotionMessage = '';
    
    if (planInfo) {
      const petLimitText = planInfo.pet_limit >= 999 
        ? "mascotas ilimitadas" 
        : `${planInfo.pet_limit} mascota${planInfo.pet_limit > 1 ? 's' : ''}`;
      
      // Obtener información de marketing
      const marketingInfo = getMarketingPrice(planInfo.name, planInfo.price);
      
      if (marketingInfo.hasDiscount) {
        const formattedMarketingPrice = marketingInfo.marketingPrice.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        const formattedRealPrice = marketingInfo.realPrice.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        const formattedDiscount = marketingInfo.discount.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        
        planDescription = `**${planInfo.name}** (~~${formattedMarketingPrice}~~ **${formattedRealPrice}/año** - ${petLimitText})`;
        promotionMessage = `\n🎉 **¡Aprovecha el descuento del ${marketingInfo.discountPercentage}%!** Ahorras ${formattedDiscount}\n`;
      } else {
        const priceText = planInfo.price.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        planDescription = `**${planInfo.name}** (${priceText}/año - ${petLimitText})`;
      }
    }

    return `🎉 ¡Excelente! Tu perfil está completo y puedes proceder con la suscripción ${planDescription}.${promotionMessage}

💳 **Información para el Pago:**
🏦 **Banco:** ${result.bankInfo.bank}
💰 **Tipo de Cuenta:** ${result.bankInfo.accountType}
🔢 **Número de Cuenta:** ${result.bankInfo.accountNumber}
💵 **Valor a Pagar:** ${result.bankInfo.amount}
📝 **Concepto:** ${result.bankInfo.concept}

📋 **Instrucciones:**
1. Realiza la transferencia por el valor exacto de ${result.bankInfo.amount}
2. Una vez hayas hecho el pago, **envíame una foto del comprobante de transferencia**
3. Notificaré al equipo administrativo para validar tu pago
4. Si existe alguna novedad con el pago, te contactaremos directamente

⚠️ **Importante:** El comprobante de pago es obligatorio para activar tu suscripción.`;
  },
  {
    name: "initiateSubscriptionTool", 
    description: "Inicia el proceso de suscripción para un plan específico mostrando la información bancaria para el pago. Incluye información de descuentos cuando aplique. Acepta tanto IDs de plan como nombres (ej: 'huellita', 'plan 1', 'doble huella', etc.). El sistema automáticamente encontrará el plan correcto.",
    schema: z.object({
      phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
      planIdentifier: z.string().min(1, "El identificador del plan (nombre o ID) es obligatorio"),
    }),
  }
);

export const processPaymentProofTool = tool(
  async ({ phoneNumber, proofImageUrl, planIdentifier }) => {
    // Pasamos el planIdentifier a la función
    const result = await processPaymentProof(phoneNumber, proofImageUrl, planIdentifier);

    if (!result.success) {
      // Si el error es específicamente que falta el plan, devolvemos un mensaje guía para la IA
      if (result.error === "PLAN_NOT_SELECTED") {
        return `⚠️ ALERTA: Recibí el comprobante, pero el sistema no sabe qué plan activar. 
        
        ACCIÓN REQUERIDA: Pregúntale al usuario: "¿Qué plan estás pagando con este comprobante?"
        
        Cuando te responda (ej: "Es el plan Huellita"), vuelve a usar esta misma herramienta 'processPaymentProofTool' enviando la misma URL de la foto Y el nombre del plan en el campo 'planIdentifier'.`;
      }
      return `❌ ${result.message}`;
    }

    return result.message;
  },
  {
    name: "processPaymentProofTool",
    description: "Procesa el comprobante de pago. Si se proporciona 'planIdentifier', asigna ese plan al usuario y ACTIVA INMEDIATAMENTE la suscripción. Si no se pasa plan y el usuario no tenía uno seleccionado previamente, fallará pidiendo que se pregunte el plan.",
    schema: processPaymentProofSchema,
  }
);

//! ================== NUEVAS HERRAMIENTAS DE PLANES ==================

export const showAvailablePlansTool = tool(
  async () => {
    const plans = await getAvailablePlans();
    
    if (plans.length === 0) {
      return "❌ No se pudieron obtener los planes disponibles. Contacte soporte.";
    }
    
    let plansMessage = "📋 **PLANES DISPONIBLES DE OLFATEA:**\n\n";
    let hasPromotions = false;
    
    plans.forEach((plan: any, index: number) => {
      // Manejar caso especial de plan ilimitado (999 = ilimitadas)
      const petLimitText = plan.pet_limit >= 999 
        ? "Ilimitadas mascotas" 
        : `Hasta ${plan.pet_limit} ${plan.pet_limit === 1 ? 'mascota' : 'mascotas'}`;
      
      plansMessage += `**${index + 1}. ${plan.name}**\n`;
      
      // Si tiene descuento, mostrar precio tachado y oferta
      if (plan.hasDiscount) {
        hasPromotions = true;
        const formattedMarketingPrice = plan.marketingPrice.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        const formattedRealPrice = plan.price.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        const formattedDiscount = plan.discount.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        
        plansMessage += `💰 Precio: ~~${formattedMarketingPrice}~~ **¡Ahora ${formattedRealPrice}!** 🎁\n`;
        plansMessage += `🎉 **AHORRO: ${formattedDiscount} (${plan.discountPercentage}% OFF)**\n`;
      } else {
        // Sin descuento, mostrar precio normal
        const formattedPrice = plan.price.toLocaleString('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          minimumFractionDigits: 0 
        });
        plansMessage += `💰 Precio: ${formattedPrice} anuales\n`;
      }
      
      plansMessage += `🐾 Mascotas: ${petLimitText}\n`;
      plansMessage += `⏱️ Duración: ${plan.duration_months} meses\n\n`;
    });
    
    if (hasPromotions) {
      plansMessage += "🔥 **¡OFERTA ESPECIAL!** Los planes de 1 a 4 mascotas tienen 50% de descuento. ¡Excelente momento para suscribirte!\n\n";
    }
    
    plansMessage += "💡 Todos los planes incluyen:\n";
    plansMessage += "• Registro completo de mascotas\n";
    plansMessage += "• Alertas de búsqueda por pérdida\n";
    plansMessage += "• Red de usuarios colaboradores\n";
    plansMessage += "• Notificaciones de avistamientos\n\n";
    plansMessage += "Para suscribirte, dime qué plan te interesa y te ayudo con el proceso.";
    
    return plansMessage;
  },
  {
    name: "showAvailablePlansTool",
    description: "Muestra todos los planes de suscripción disponibles con precios, límites de mascotas y características. Incluye información de descuentos cuando aplique. Usar cuando el usuario pregunte por planes o durante el proceso de suscripción.",
    schema: z.object({}),
  }
);

export const validateCurrentPetLimitTool = tool(
  async ({ phoneNumber }) => {
    const validation = await validatePetLimit(phoneNumber);
    
    if (!validation.canRegister && validation.planName === "Sin suscripción") {
      return `❌ No tienes suscripción activa. Necesitas suscribirte a un plan para registrar mascotas.`;
    }
    
    if (!validation.canRegister && validation.planName === "Plan no válido") {
      return `❌ Tu plan de suscripción no es válido. Contacta soporte para resolver este problema.`;
    }
    
    if (validation.canRegister) {
      // Manejar caso especial de plan ilimitado (999 = ilimitadas)
      const isUnlimited = validation.planLimit >= 999;
      
      if (isUnlimited) {
        return `✅ **${validation.planName}**: Tienes ${validation.currentPetCount} mascotas registradas. Tu plan permite mascotas ilimitadas, así que puedes registrar todas las que quieras.`;
      } else {
        const remaining = validation.planLimit - validation.currentPetCount;
        return `✅ **${validation.planName}**: Tienes ${validation.currentPetCount}/${validation.planLimit} mascotas registradas. Puedes registrar ${remaining} mascota(s) más.`;
      }
    } else {
      return `⚠️ **${validation.planName}**: Has alcanzado el límite de ${validation.planLimit} mascotas. Tienes ${validation.currentPetCount} mascotas registradas. Debes esperar a que termine tu suscripción actual para cambiar a un plan con más mascotas.`;
    }
  },
  {
    name: "validateCurrentPetLimitTool",
    description: "Verifica rápidamente si un usuario puede registrar más mascotas sin intentar el registro completo. Muestra información clara del plan actual y límites.",
    schema: z.object({
      phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
  }
);

export const getLostPetPhotoTool = tool(
  async ({ petName }) => {
    const petInfo = await getLostPetPhotoByName(petName);

    if (!petInfo) {
      return `⚠️ No encontré una alerta activa para una mascota llamada "${petName}" en nuestra base de datos actual.\n\nEs posible que ya la hayan encontrado y la alerta se haya cerrado, o que no haya sido reportada con nosotros aún.`;
    }

    const species = petInfo.species || 'No especificada';
    const breed = petInfo.breed || 'No especificada';
    const gender = petInfo.gender || 'No especificado';
    const location = petInfo.alert_notes || 'No especificada';
    const description = petInfo.last_seen_description || 'Sin descripción adicional';

    if (!petInfo.pet_photo_url) {
      return `⚠️ La mascota **${petInfo.pet_name}** tiene una alerta activa, pero lamentablemente el dueño no cargó una fotografía al momento de reportarla.

🐾 **Datos de la mascota:**
• Especie: ${species}
• Raza: ${breed}
• Género: ${gender}

📍 **Ubicación de pérdida:** ${location}
📝 **Descripción:** ${description}`;
    }

    return `✅ Aquí tienes la foto y detalles de **${petInfo.pet_name}** para difundirla:

🖼️ **FOTO:** ${petInfo.pet_photo_url}

🐾 **Datos de la mascota:**
• Especie: ${species}
• Raza: ${breed}
• Género: ${gender}

📍 **Ubicación:** ${location}
📝 **Descripción:** ${description}`;
  },
  {
    name: "getLostPetPhotoTool",
    description: "Busca la foto y detalles de una mascota perdida específica por su nombre para ayudar en su difusión. Verifica si existe una alerta activa en el sistema. Úsalo cuando el usuario pida información o la foto de una mascota perdida específica (ej: 'dame la foto de Lamby').",
    schema: z.object({
      petName: z.string().min(1, "El nombre de la mascota es obligatorio"),
    }),
  }
);