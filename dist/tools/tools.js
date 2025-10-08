var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { testFunction, createPet, updateClientProfile, createLostPetAlert, getOwnerPets, getOwnerPetsOptimized, getOwnerActiveLostPets, updatePet, createFoundPetSighting, hasActiveSubscription, 
// Nuevas funciones de planes
getPlanDetails, getAvailablePlans, validatePetLimit, findPlanByName, // Nueva función para buscar planes por nombre
// ------
searchLostPetsFTS, 
// Nuevas funciones de suscripción
validateCompleteProfile, initiateSubscriptionProcess, processPaymentProof, 
// Agregar supabase para usar en neighborhood
supabase, } from "../utils/functions.js";
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
export const testTool = tool(() => __awaiter(void 0, void 0, void 0, function* () {
    const results = yield testFunction();
    return results;
}), {
    name: "testTool",
    description: "Tool de prueba",
});
export const checkSubscriptionStatusTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber }) {
    var _b;
    const subscriptionStatus = yield hasActiveSubscription(phoneNumber);
    if (subscriptionStatus.active) {
        // Obtener información de límites de mascotas
        const petLimitInfo = yield validatePetLimit(phoneNumber);
        let planMessage = "";
        if (subscriptionStatus.plan) {
            planMessage = `\n📋 PLAN: ${subscriptionStatus.plan.name} (${subscriptionStatus.plan.price.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })})`;
            planMessage += `\n🐾 MASCOTAS: ${petLimitInfo.currentPetCount}/${subscriptionStatus.plan.pet_limit} registradas`;
            if (petLimitInfo.canRegister) {
                const remaining = subscriptionStatus.plan.pet_limit - petLimitInfo.currentPetCount;
                planMessage += `\n✅ Puede registrar ${remaining} mascota(s) más`;
            }
            else {
                planMessage += `\n⚠️ Ha alcanzado el límite de su plan`;
            }
        }
        return `✅ SUSCRIPCIÓN ACTIVA: ${subscriptionStatus.reason}${planMessage}\n\n✅ El usuario PUEDE gestionar sus mascotas.`;
    }
    else {
        // Determinar el mensaje específico según el estado
        let message = "";
        let actionRequired = "";
        switch (subscriptionStatus.status) {
            case 'expired':
                message = `❌ SUSCRIPCIÓN EXPIRADA: ${subscriptionStatus.reason}`;
                actionRequired = "Debe renovar su suscripción para continuar registrando mascotas.";
                break;
            case 'none':
                if ((_b = subscriptionStatus.reason) === null || _b === void 0 ? void 0 : _b.includes('no encontrado')) {
                    message = `❌ PERFIL NO ENCONTRADO: ${subscriptionStatus.reason}`;
                    actionRequired = "Debe registrarse y adquirir un plan de suscripción.";
                }
                else {
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
}), {
    name: "checkSubscriptionStatusTool",
    description: "HERRAMIENTA CRÍTICA: Verifica si un usuario tiene suscripción activa y muestra información detallada del plan (límites de mascotas, mascotas registradas). DEBE usarse SIEMPRE antes de crear o modificar mascotas para evitar desperdiciar el tiempo del usuario.",
    schema: z.object({
        phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
});
export const createPetTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ clientNumber, name, species, breed, gender, photo_url }) {
    // Validar formato de URL si se proporciona
    if (photo_url && photo_url.trim() !== "") {
        try {
            new URL(photo_url.trim());
        }
        catch (error) {
            return "Error: La URL de la foto no es válida. Debe ser una URL completa (ej: https://ejemplo.com/imagen.jpg).";
        }
    }
    // Crear objeto PetData con los datos básicos
    const petData = {
        name: name.trim(),
        species: (species === null || species === void 0 ? void 0 : species.trim()) || undefined,
        breed: (breed === null || breed === void 0 ? void 0 : breed.trim()) || undefined,
        gender: (gender === null || gender === void 0 ? void 0 : gender.trim()) || undefined,
        photo_url: (photo_url === null || photo_url === void 0 ? void 0 : photo_url.trim()) || undefined,
    };
    const petId = yield createPet(clientNumber, petData);
    if (petId) {
        return `Mascota creada exitosamente con ID: ${petId}. Nombre: ${petData.name}${petData.species ? `, Especie: ${petData.species}` : ""}${petData.breed ? `, Raza: ${petData.breed}` : ""}${petData.gender ? `, Género: ${petData.gender}` : ""}${petData.photo_url ? `, Foto: ${petData.photo_url}` : ""}`;
    }
    else {
        return "Error: No se pudo crear la mascota. Verifique los datos proporcionados.";
    }
}), {
    name: "createPetTool",
    description: "Crea una mascota asociada a un usuario por número de teléfono. Requiere al menos el nombre de la mascota. Los campos especie, raza, género y URL de foto son opcionales. La URL de la foto debe ser una URL válida.",
    schema: basicPetDataSchema,
});
export const updateProfileTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber, fullName, email, city, country }) {
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
    const result = yield updateClientProfile(phoneNumber, fullName || undefined, email || undefined, city || undefined, country || undefined);
    if (result) {
        return result;
    }
    else {
        return "Error: No se pudo actualizar el perfil. Verifique que el número de teléfono sea correcto y que el perfil exista.";
    }
}), {
    name: "updateProfileTool",
    description: "Actualiza los datos del perfil de un cliente existente por número de teléfono. Permite actualizar nombre completo, email, ciudad y país. Al menos un campo debe ser proporcionado para realizar la actualización.",
    schema: updateProfileSchema,
});
export const createLostPetAlertTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber, petName, lastSeenAt, lastSeenDescription, lastSeenLocation, lastSeenCity, lastSeenCountry, additionalInfo, }) {
    // Validar formato de fecha básico
    if (lastSeenAt && lastSeenAt.trim() !== "") {
        const dateTest = new Date(lastSeenAt.trim());
        if (isNaN(dateTest.getTime())) {
            return "Error: El formato de la fecha no es válido. Use formato ISO (ej: 2024-01-15T10:30:00Z) o un formato reconocible.";
        }
    }
    // Combinar ubicación completa incluyendo ciudad y país
    const fullLocation = [
        lastSeenLocation === null || lastSeenLocation === void 0 ? void 0 : lastSeenLocation.trim(),
        lastSeenCity === null || lastSeenCity === void 0 ? void 0 : lastSeenCity.trim(),
        lastSeenCountry === null || lastSeenCountry === void 0 ? void 0 : lastSeenCountry.trim()
    ].filter(Boolean).join(", ");
    const alertData = {
        last_seen_at: lastSeenAt.trim(),
        last_seen_description: (lastSeenDescription === null || lastSeenDescription === void 0 ? void 0 : lastSeenDescription.trim()) || undefined,
        last_seen_location: fullLocation,
        additional_info: (additionalInfo === null || additionalInfo === void 0 ? void 0 : additionalInfo.trim()) || undefined,
    };
    const result = yield createLostPetAlert(phoneNumber, alertData, undefined, // petId ya no se usa como parámetro principal
    (petName === null || petName === void 0 ? void 0 : petName.trim()) || undefined);
    if (result) {
        return result;
    }
    else {
        return "Error: No se pudo crear la alerta de mascota perdida. Verifique los datos proporcionados.";
    }
}), {
    name: "createLostPetAlertTool",
    description: "Crea una alerta de mascota perdida para un propietario por número de teléfono. Requiere OBLIGATORIAMENTE: fecha/hora de última vez vista, ciudad y país donde se perdió. Si el propietario tiene múltiples mascotas, debe especificar el nombre de la mascota. Los campos de descripción, ubicación específica e información adicional son opcionales.",
    schema: lostPetAlertSchema,
});
export const getOwnerPetsTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber }) {
    const pets = yield getOwnerPets(phoneNumber);
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
        return `- ${pet.name}${lostStatus}\n  Especie: ${pet.species || "No especificada"}\n  Raza: ${pet.breed || "No especificada"}\n  Género: ${pet.gender || "No especificado"}${photoInfo}`;
    })
        .join("\n\n");
    return `Mascotas registradas para este propietario:\n\n${petList}`;
}), {
    name: "getOwnerPetsTool",
    description: "Obtiene la lista de mascotas registradas para un propietario por número de teléfono. Útil para ver las mascotas disponibles antes de crear una alerta de pérdida o para actualizar información.",
    schema: z.object({
        phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
});
export const getOwnerPetsOptimizedTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber }) {
    const pets = yield getOwnerPetsOptimized(phoneNumber);
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
        return `- ${pet.name}${alertStatus}\n  Especie: ${pet.species || "No especificada"}\n  Raza: ${pet.breed || "No especificada"}\n  Género: ${pet.gender || "No especificado"}${lastSeenInfo}${photoInfo}`;
    })
        .join("\n\n");
    return `Mascotas registradas para este propietario:\n\n${petList}`;
}), {
    name: "getOwnerPetsOptimizedTool",
    description: "Versión optimizada que obtiene la lista de mascotas de un propietario incluyendo información de alertas activas. Más eficiente para mostrar el estado actual de las mascotas.",
    schema: z.object({
        phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
});
export const getOwnerActiveLostPetsTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber }) {
    const activePets = yield getOwnerActiveLostPets(phoneNumber);
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
        return `🚨 ${pet.pet_name}\n  Especie: ${pet.species || "No especificada"}\n  Raza: ${pet.breed || "No especificada"}\n  Color: ${pet.color || "No especificado"}\n  Género: ${pet.gender || "No especificado"}${marksInfo}${photoInfo}${lastSeenInfo}${locationInfo}${notesInfo}`;
    })
        .join("\n\n");
    return `🔍 Mascotas con alertas activas:\n\n${petList}`;
}), {
    name: "getOwnerActiveLostPetsTool",
    description: "Obtiene únicamente las mascotas con alertas activas de un propietario, con información completa de la alerta. Ideal para consultas rápidas sobre mascotas perdidas.",
    schema: z.object({
        phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
});
export const updatePetTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber, petIdentifier, name, species, breed, color, birth_date, gender, photo_url, distinguishing_marks, }) {
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
        }
        catch (error) {
            return "Error: La URL de la foto no es válida. Debe ser una URL completa (ej: https://ejemplo.com/imagen.jpg).";
        }
    }
    // Preparar los datos para actualizar
    const petData = {};
    if (name)
        petData.name = name;
    if (species)
        petData.species = species;
    if (breed)
        petData.breed = breed;
    if (color)
        petData.color = color;
    if (birth_date)
        petData.birth_date = birth_date;
    if (gender)
        petData.gender = gender;
    if (photo_url)
        petData.photo_url = photo_url;
    if (distinguishing_marks)
        petData.distinguishing_marks = distinguishing_marks;
    const result = yield updatePet(phoneNumber, petIdentifier, petData);
    if (result) {
        return result;
    }
    else {
        return "Error: No se pudo actualizar la mascota. Verifique que el número de teléfono sea correcto, que la mascota exista y que los datos proporcionados sean válidos.";
    }
}), {
    name: "updatePetTool",
    description: "Actualiza los datos de una mascota existente. Permite actualizar nombre, especie, raza, color, fecha de nacimiento, género, URL de foto y marcas distintivas. La mascota se identifica por su ID o nombre. Al menos un campo debe ser proporcionado para realizar la actualización.",
    schema: updatePetSchema,
});
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
export const createFoundPetSightingTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ finderPhone, finderName, petDescription, locationFound, cityFound, countryFound, photoUrl, alertId }) {
    // Validar formato de URL si se proporciona
    if (photoUrl && photoUrl.trim() !== "") {
        try {
            new URL(photoUrl.trim());
        }
        catch (error) {
            return "Error: La URL de la foto no es válida. Debe ser una URL completa (ej: https://ejemplo.com/imagen.jpg).";
        }
    }
    // Combinar ubicación completa incluyendo ciudad y país
    const fullLocation = [
        locationFound === null || locationFound === void 0 ? void 0 : locationFound.trim(),
        cityFound === null || cityFound === void 0 ? void 0 : cityFound.trim(),
        countryFound === null || countryFound === void 0 ? void 0 : countryFound.trim()
    ].filter(Boolean).join(", ");
    const result = yield createFoundPetSighting(finderPhone, finderName, petDescription, fullLocation, photoUrl || undefined, alertId || undefined);
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
    }
    else {
        return "Error: No se pudo registrar el avistamiento de la mascota encontrada. Verifique los datos proporcionados.";
    }
}), {
    name: "createFoundPetSightingTool",
    description: "Herramienta UNIFICADA para registrar avistamientos de mascotas encontradas. Puede funcionar de dos formas: 1) Sin alertId: Solo registra el avistamiento para futuras coincidencias. 2) Con alertId: Registra + confirma match + envía notificación automáticamente. Requiere información de contacto, descripción, ubicación, ciudad y país. Opcionalmente foto y alertId para match automático.",
    schema: createFoundPetSightingSchema,
});
//! Prueba de consulta con Supabase Function
// Esquema Zod para la nueva herramienta de búsqueda
const findLostPetsSchema = z.object({
    description: z
        .string()
        .min(5, "La descripción debe tener al menos 5 caracteres para ser efectiva."),
});
// --- LA NUEVA HERRAMIENTA ---
export const findLostPetsTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ description }) {
    // 1. Llamar a la función de utilidad que habla con Supabase
    const searchResult = yield searchLostPetsFTS(description);
    // 2. Manejar los posibles errores o casos sin resultados
    if (searchResult.error) {
        return searchResult.error;
    }
    if (searchResult.results.length === 0) {
        return "No se encontraron mascotas perdidas que coincidan con la descripción proporcionada. Agradécele al usuario por su ayuda de todas formas.";
    }
    // 3. Formatear el resultado JSON en un string claro para la IA
    //    Esta es la parte clave para solucionar el problema de contexto.
    const formattedResults = searchResult.results.map((pet, index) => {
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
}), {
    name: "find_lost_pets_by_description",
    description: "DEBES usar esta herramienta cuando un usuario te informa que ha encontrado una mascota y te da una descripción de ella. La entrada debe ser un texto detallado que describa la mascota y la ubicación donde fue encontrada (ej: 'gato tricolor con collar rojo en el parque de Belén'). La herramienta buscará en la base de datos y devolverá las coincidencias más probables con toda su información.",
    schema: findLostPetsSchema,
});
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
    proofImageUrl: z.string().url("La URL de la imagen del comprobante debe ser válida").min(1, "La URL de la imagen del comprobante es obligatoria"),
});
export const validateCompleteProfileTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber }) {
    const result = yield validateCompleteProfile(phoneNumber);
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
    }
    else {
        const fieldNames = {
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
}), {
    name: "validateCompleteProfileTool",
    description: "Verifica si el perfil de un usuario está completo con todos los datos requeridos para la suscripción (nombre, email, ciudad, país, barrio). Usar antes de iniciar proceso de suscripción.",
    schema: validateCompleteProfileSchema,
});
export const updateCompleteProfileTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber, fullName, email, city, country, neighborhood }) {
    var _b, _c, _d, _e, _f;
    // Validar que al menos un campo adicional sea proporcionado
    const fieldsProvided = [fullName, email, city, country, neighborhood].filter(field => field !== undefined && field !== null && field !== "");
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
            const basicResult = yield updateClientProfile(phoneNumber, fullName || undefined, email || undefined, city || undefined, country || undefined);
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
            const { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (profileError || !profile) {
                console.log(`❌ Error encontrando perfil para neighborhood:`, profileError);
                return "❌ Error encontrando el perfil para actualizar el barrio.";
            }
            // Actualizar neighborhood
            const { error: updateError } = yield supabase
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
        const validation = yield validateCompleteProfile(phoneNumber);
        console.log(`📊 Resultado validación:`, validation);
        if (validation.isComplete) {
            console.log(`✅ Perfil completo!`);
            return `✅ ¡Perfecto! Tu perfil ha sido actualizado y ahora está completo:

📋 **Información Actualizada:**
• **Nombre:** ${(_b = validation.profile) === null || _b === void 0 ? void 0 : _b.full_name}
• **Email:** ${(_c = validation.profile) === null || _c === void 0 ? void 0 : _c.email}
• **Ciudad:** ${(_d = validation.profile) === null || _d === void 0 ? void 0 : _d.city}
• **País:** ${(_e = validation.profile) === null || _e === void 0 ? void 0 : _e.country}  
• **Barrio:** ${(_f = validation.profile) === null || _f === void 0 ? void 0 : _f.neighborhood}

Ya puedes proceder con la suscripción.`;
        }
        else {
            console.log(`⚠️ Perfil incompleto, faltan campos:`, validation.missingFields);
            const fieldNames = {
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
    }
    catch (error) {
        console.error(`❌ Error en updateCompleteProfileTool:`, error);
        return `❌ Error actualizando el perfil: ${error}`;
    }
}), {
    name: "updateCompleteProfileTool",
    description: "Actualiza el perfil del usuario con todos los datos necesarios para la suscripción, incluyendo nombre, email, ciudad, país y barrio. Extensión de updateProfileTool que incluye neighborhood.",
    schema: updateCompleteProfileSchema,
});
export const findPlanByNameTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ planName }) {
    const plan = yield findPlanByName(planName);
    if (!plan) {
        const availablePlans = yield getAvailablePlans();
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
}), {
    name: "findPlanByNameTool",
    description: "Busca un plan específico por nombre o identificador (acepta nombres parciales, números de plan, etc.). Útil cuando el usuario menciona un plan específico como 'huellita', 'plan 1', 'doble huella', etc.",
    schema: z.object({
        planName: z.string().min(1, "El nombre o identificador del plan es obligatorio"),
    }),
});
export const initiateSubscriptionTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber, planIdentifier }) {
    // Primero, intentar encontrar el plan por nombre o ID
    let planDetails;
    // Si parece ser un UUID, usar getPlanDetails directamente
    if (planIdentifier.length > 20 && planIdentifier.includes('-')) {
        planDetails = yield getPlanDetails(planIdentifier);
    }
    else {
        // Si es un nombre o identificador corto, usar findPlanByName
        planDetails = yield findPlanByName(planIdentifier);
    }
    if (!planDetails) {
        const availablePlans = yield getAvailablePlans();
        let plansList = "📋 **PLANES DISPONIBLES:**\n\n";
        availablePlans.forEach((plan, index) => {
            const petLimitText = plan.pet_limit >= 999
                ? "mascotas ilimitadas"
                : `${plan.pet_limit} mascota${plan.pet_limit > 1 ? 's' : ''}`;
            const priceText = plan.price.toLocaleString('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0
            });
            plansList += `${index + 1}. **${plan.name}:** ${priceText}/año (${petLimitText})\n`;
        });
        return `❌ No se encontró el plan "${planIdentifier}". \n\n${plansList}\n\nPor favor, especifica el nombre exacto del plan que te interesa.`;
    }
    // Ahora usar el ID correcto del plan encontrado
    const result = yield initiateSubscriptionProcess(phoneNumber, planDetails.id);
    if (!result.success) {
        return result.message;
    }
    const planInfo = result.planSelected;
    let planDescription = '';
    if (planInfo) {
        const petLimitText = planInfo.pet_limit >= 999
            ? "mascotas ilimitadas"
            : `${planInfo.pet_limit} mascota${planInfo.pet_limit > 1 ? 's' : ''}`;
        const priceText = planInfo.price.toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        });
        planDescription = `**${planInfo.name}** (${priceText}/año - ${petLimitText})`;
    }
    return `🎉 ¡Excelente! Tu perfil está completo y puedes proceder con la suscripción ${planDescription}.

💳 **Información para el Pago:**
🏦 **Banco:** ${result.bankInfo.bank}
💰 **Tipo de Cuenta:** ${result.bankInfo.accountType}
🔢 **Número de Cuenta:** ${result.bankInfo.accountNumber}
👤 **Titular:** ${result.bankInfo.accountHolder}
📄 **NIT:** ${result.bankInfo.nit}
💵 **Valor a Pagar:** ${result.bankInfo.amount}
📝 **Concepto:** ${result.bankInfo.concept}

📋 **Instrucciones:**
1. Realiza la transferencia por el valor exacto de ${result.bankInfo.amount}
2. Una vez hayas hecho el pago, **envíame una foto del comprobante de transferencia**
3. Notificaré al equipo administrativo para validar tu pago
4. Si existe alguna novedad con el pago, te contactaremos directamente

⚠️ **Importante:** El comprobante de pago es obligatorio para activar tu suscripción.`;
}), {
    name: "initiateSubscriptionTool",
    description: "Inicia el proceso de suscripción para un plan específico mostrando la información bancaria para el pago. Acepta tanto IDs de plan como nombres (ej: 'huellita', 'plan 1', 'doble huella', etc.). El sistema automáticamente encontrará el plan correcto.",
    schema: z.object({
        phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
        planIdentifier: z.string().min(1, "El identificador del plan (nombre o ID) es obligatorio"),
    }),
});
export const processPaymentProofTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber, proofImageUrl }) {
    const result = yield processPaymentProof(phoneNumber, proofImageUrl);
    if (!result.success) {
        return `❌ ${result.message}`;
    }
    // La respuesta ya está formateada en la función processPaymentProof
    // Solo devolvemos el mensaje directamente
    return result.message;
}), {
    name: "processPaymentProofTool",
    description: "Procesa el comprobante de pago enviado por el usuario y ACTIVA INMEDIATAMENTE la suscripción, luego notifica al admin para validación posterior. La suscripción queda activa desde el momento del envío del comprobante.",
    schema: processPaymentProofSchema,
});
//! ================== NUEVAS HERRAMIENTAS DE PLANES ==================
export const showAvailablePlansTool = tool(() => __awaiter(void 0, void 0, void 0, function* () {
    const plans = yield getAvailablePlans();
    if (plans.length === 0) {
        return "❌ No se pudieron obtener los planes disponibles. Contacte soporte.";
    }
    let plansMessage = "📋 **PLANES DISPONIBLES DE OLFATEA:**\n\n";
    plans.forEach((plan, index) => {
        const formattedPrice = plan.price.toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        });
        // Manejar caso especial de plan ilimitado (999 = ilimitadas)
        const petLimitText = plan.pet_limit >= 999
            ? "Ilimitadas mascotas"
            : `Hasta ${plan.pet_limit} ${plan.pet_limit === 1 ? 'mascota' : 'mascotas'}`;
        plansMessage += `**${index + 1}. ${plan.name}**\n`;
        plansMessage += `💰 Precio: ${formattedPrice} anuales\n`;
        plansMessage += `🐾 Mascotas: ${petLimitText}\n`;
        plansMessage += `⏱️ Duración: ${plan.duration_months} meses\n\n`;
    });
    plansMessage += "💡 Todos los planes incluyen:\n";
    plansMessage += "• Registro completo de mascotas\n";
    plansMessage += "• Alertas de búsqueda por pérdida\n";
    plansMessage += "• Red de usuarios colaboradores\n";
    plansMessage += "• Notificaciones de avistamientos\n\n";
    plansMessage += "Para suscribirte, dime qué plan te interesa y te ayudo con el proceso.";
    return plansMessage;
}), {
    name: "showAvailablePlansTool",
    description: "Muestra todos los planes de suscripción disponibles con precios, límites de mascotas y características. Usar cuando el usuario pregunte por planes o durante el proceso de suscripción.",
    schema: z.object({}),
});
export const validateCurrentPetLimitTool = tool((_a) => __awaiter(void 0, [_a], void 0, function* ({ phoneNumber }) {
    const validation = yield validatePetLimit(phoneNumber);
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
        }
        else {
            const remaining = validation.planLimit - validation.currentPetCount;
            return `✅ **${validation.planName}**: Tienes ${validation.currentPetCount}/${validation.planLimit} mascotas registradas. Puedes registrar ${remaining} mascota(s) más.`;
        }
    }
    else {
        return `⚠️ **${validation.planName}**: Has alcanzado el límite de ${validation.planLimit} mascotas. Tienes ${validation.currentPetCount} mascotas registradas. Debes esperar a que termine tu suscripción actual para cambiar a un plan con más mascotas.`;
    }
}), {
    name: "validateCurrentPetLimitTool",
    description: "Verifica rápidamente si un usuario puede registrar más mascotas sin intentar el registro completo. Muestra información clara del plan actual y límites.",
    schema: z.object({
        phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
});
