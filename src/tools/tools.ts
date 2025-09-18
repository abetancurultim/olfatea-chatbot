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
  updatePet,
  createFoundPetSighting,
  sendPetSightingNotification,
  // ------
  searchLostPetsFTS,
} from "../utils/functions";

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
}

// Esquema Zod para validación de datos básicos de mascota
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

export const createPetTool = tool(
  async ({ clientNumber, name, species, breed, gender, photo_url }) => {
    // Validar formato de URL si se proporciona
    if (photo_url && photo_url.trim() !== "") {
      try {
        new URL(photo_url.trim());
      } catch (error) {
        return "Error: La URL de la foto no es válida. Debe ser una URL completa (ej: https://ejemplo.com/imagen.jpg).";
      }
    }

    // Crear objeto PetData con los datos básicos
    const petData: PetData = {
      name: name.trim(),
      species: species?.trim() || undefined,
      breed: breed?.trim() || undefined,
      gender: gender?.trim() || undefined,
      photo_url: photo_url?.trim() || undefined,
    };

    const petId = await createPet(clientNumber, petData);

    if (petId) {
      return `Mascota creada exitosamente con ID: ${petId}. Nombre: ${
        petData.name
      }${petData.species ? `, Especie: ${petData.species}` : ""}${
        petData.breed ? `, Raza: ${petData.breed}` : ""
      }${petData.gender ? `, Género: ${petData.gender}` : ""}${
        petData.photo_url ? `, Foto: ${petData.photo_url}` : ""
      }`;
    } else {
      return "Error: No se pudo crear la mascota. Verifique los datos proporcionados.";
    }
  },
  {
    name: "createPetTool",
    description:
      "Crea una mascota asociada a un usuario por número de teléfono. Requiere al menos el nombre de la mascota. Los campos especie, raza, género y URL de foto son opcionales. La URL de la foto debe ser una URL válida.",
    schema: basicPetDataSchema,
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

// Esquema Zod para crear avistamiento de mascota encontrada (unificado)
const createFoundPetSightingSchema = z.object({
  finderPhone: z.string().min(1, "El número de teléfono de quien encontró la mascota es obligatorio"),
  finderName: z.string().min(1, "El nombre de quien encontró la mascota es obligatorio"),
  petDescription: z.string().min(1, "La descripción de la mascota encontrada es obligatoria"),
  locationFound: z.string().min(1, "La ubicación donde se encontró la mascota es obligatoria"),
  cityFound: z.string().min(1, "La ciudad donde se encontró es OBLIGATORIA"),
  countryFound: z.string().min(1, "El país donde se encontró es OBLIGATORIO"),
  photoUrl: z.string().url("La URL de la foto debe ser válida").optional(),
  alertId: z.string().optional(), // Nuevo parámetro opcional para hacer match automático
});

export const createFoundPetSightingTool = tool(
  async ({ finderPhone, finderName, petDescription, locationFound, cityFound, countryFound, photoUrl, alertId }) => {
    // Validar formato de URL si se proporciona
    if (photoUrl && photoUrl.trim() !== "") {
      try {
        new URL(photoUrl.trim());
      } catch (error) {
        return "Error: La URL de la foto no es válida. Debe ser una URL completa (ej: https://ejemplo.com/imagen.jpg).";
      }
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
      photoUrl || undefined,
      alertId || undefined
    );

    if (result) {
      // Si es solo un avistamiento sin match
      if (!result.isMatch) {
        return `Avistamiento registrado exitosamente en ${cityFound}, ${countryFound}. ID del avistamiento: ${result.sightingId}. Este reporte quedará disponible para futuras alertas que coincidan.`;
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
¡MASCOTA ENCONTRADA Y MATCH CONFIRMADO! 

${result.pet.name} (${result.pet.species || 'mascota'} ${result.pet.breed || ''}) ha sido encontrada.

DUEÑO:
- Nombre: ${result.owner.name}
- Teléfono: ${result.owner.phone}

PERSONA QUE LA ENCONTRÓ:
- Nombre: ${result.finder.name}  
- Teléfono: ${result.finder.phone}
- Ubicación: ${result.finder.location}
- Descripción: ${result.finder.description}
${result.finder.photoUrl ? `- Foto: ${result.finder.photoUrl}` : ''}

📱 Estado de notificación: ${notificationStatus}

El match ha sido confirmado automáticamente y ambas partes pueden contactarse directamente.
      `.trim();

      return detailedMessage;
    } else {
      return "Error: No se pudo registrar el avistamiento de la mascota encontrada. Verifique los datos proporcionados.";
    }
  },
  {
    name: "createFoundPetSightingTool",
    description:
      "Herramienta UNIFICADA para registrar avistamientos de mascotas encontradas. Puede funcionar de dos formas: 1) Sin alertId: Solo registra el avistamiento para futuras coincidencias. 2) Con alertId: Registra + confirma match + envía notificación automáticamente. Requiere información de contacto, descripción, ubicación, ciudad y país. Opcionalmente foto y alertId para match automático.",
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