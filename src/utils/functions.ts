import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
// Import colombia.json file

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Función auxiliar para validar si una cadena es un UUID válido
 * @param uuid La cadena a validar
 * @returns true si es un UUID válido, false en caso contrario
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/*
🚀 OPTIMIZACIONES IMPLEMENTADAS (Sept 2025):

📊 TABLA ACTIVE_LOST_PETS_DETAILS:
Esta tabla espejo contiene toda la información consolidada de mascotas con alertas activas,
eliminando la necesidad de hacer JOINs complejos para consultas de mascotas perdidas.

🔧 FUNCIONES OPTIMIZADAS:
- validatePetOwnershipOptimized(): Busca primero en active_lost_pets_details, fallback a pets
- getOwnerPetsOptimized(): Combina datos de pets con información de alertas activas  
- getOwnerActiveLostPets(): Consulta directa a active_lost_pets_details (más rápida)
- createLostPetAlert(): Usa active_lost_pets_details para verificar alertas existentes

📍 INFORMACIÓN DE UBICACIÓN MEJORADA (Sept 2025):
- searchLostPetsImproved(): Incluye campo lostLocationDetails consolidado
- searchLostPets(): Incluye campo lostLocationDetails consolidado
- lostLocationDetails: Combina last_seen_description, alert_notes, y owner_city
- Ayuda a quienes reportan avistamientos a verificar proximidad de ubicación

⚡ BENEFICIOS:
- Menos consultas a BD para verificaciones de alertas
- Mejor rendimiento en búsquedas de mascotas perdidas
- Información más rica (combina datos de ambas tablas)
- Información de ubicación clara y consolidada para verificación
- Mantiene compatibilidad con funciones existentes

📋 ESTRATEGIA DE USO:
- Tabla 'pets': Registro/gestión general de mascotas
- Tabla 'active_lost_pets_details': Consultas y verificaciones de alertas activas
- Funciones optimizadas: Balance entre rendimiento e información completa
*/

// Función para tool de prueba
export const testFunction = async () => {
  return "Hola, este es un mensaje de prueba";
};

// Interfaz para datos de mascota
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

// Interfaz para datos de alerta de mascota perdida
interface LostPetAlertData {
  last_seen_at: string; // ISO timestamp
  last_seen_description?: string;
  last_seen_location?: string;
  additional_info?: string;
}

// Interfaz para el resultado de createFoundPetSighting
interface PetSightingResult {
  success: boolean;
  sightingId: string;
  isMatch: boolean;
  notificationSent: boolean;
  notificationError: string | null;
  pet: {
    name: string;
    species: string;
    breed: string;
  } | null;
  owner: {
    name: string;
    phone: string;
  } | null;
  finder: {
    name: string;
    phone: string;
    location: string;
    description: string;
    photoUrl: string | null;
  };
}

// Interfaz para el estado de suscripción
interface SubscriptionStatus {
  active: boolean;
  status: 'active' | 'expired' | 'none';
  reason?: string;
  profile?: {
    id: string;
    is_subscriber: boolean;
    subscription_activated_at: string | null;
    subscription_expires_at: string | null;
  } | null;
  expiresAt?: string;
}

// Interfaz para la respuesta estructurada de createPet
interface CreatePetResult {
  success: boolean;
  petId?: string;
  error?: {
    code: 'SUBSCRIPTION_REQUIRED' | 'SUBSCRIPTION_EXPIRED' | 'SUBSCRIPTION_INVALID' | 'VALIDATION_ERROR' | 'DATABASE_ERROR';
    message: string;
    status?: string;
  };
}

/**
 * Función para validar si un usuario tiene una suscripción activa
 * @param phoneNumber El número de teléfono del usuario
 * @returns Objeto con estado de suscripción y detalles
 */
export async function hasActiveSubscription(phoneNumber: string): Promise<SubscriptionStatus> {
  try {
    // Consultar perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, is_subscriber, subscription_activated_at, subscription_expires_at")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (profileError) {
      return {
        active: false,
        status: 'none',
        reason: `Error consultando perfil: ${profileError.message}`,
        profile: null
      };
    }

    // Si no existe perfil
    if (!profile) {
      return {
        active: false,
        status: 'none',
        reason: 'Perfil no encontrado - necesita registrarse y suscribirse',
        profile: null
      };
    }

    // Si no es suscriptor
    if (!profile.is_subscriber) {
      return {
        active: false,
        status: 'none',
        reason: 'No tiene suscripción activa - debe adquirir plan de $26.000 anuales',
        profile: profile
      };
    }

    // Si es suscriptor pero faltan fechas (inconsistencia de datos)
    if (!profile.subscription_activated_at || !profile.subscription_expires_at) {
      return {
        active: false,
        status: 'none',
        reason: 'Suscripción incompleta - contacte soporte para activar',
        profile: profile
      };
    }

    // Validar si la suscripción está vigente
    const now = new Date();
    const expiresAt = new Date(profile.subscription_expires_at);

    if (now >= expiresAt) {
      return {
        active: false,
        status: 'expired',
        reason: `Suscripción expiró el ${expiresAt.toLocaleDateString('es-CO')} - renueve para continuar`,
        profile: profile,
        expiresAt: profile.subscription_expires_at
      };
    }

    // Suscripción activa
    return {
      active: true,
      status: 'active',
      reason: `Suscripción activa hasta ${expiresAt.toLocaleDateString('es-CO')}`,
      profile: profile,
      expiresAt: profile.subscription_expires_at
    };

  } catch (error) {
    console.error("Error en hasActiveSubscription:", error);
    return {
      active: false,
      status: 'none',
      reason: `Error técnico validando suscripción: ${error}`,
      profile: null
    };
  }
}

/**
 * Función para crear una mascota asociada a un usuario por número de teléfono
 * REQUIERE SUSCRIPCIÓN ACTIVA para poder registrar mascotas
 * @param clientNumber El número de teléfono del propietario
 * @param petData Datos de la mascota (mínimo: nombre)
 * @returns Objeto con resultado de la operación
 */
export async function createPet(
  clientNumber: string,
  petData: PetData
): Promise<CreatePetResult> {
  try {
    // Validar datos mínimos requeridos
    if (!petData.name || petData.name.trim() === "") {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: "El nombre de la mascota es obligatorio"
        }
      };
    }

    // --- VALIDACIÓN DE SUSCRIPCIÓN ---
    console.log(`🔐 Validando suscripción para ${clientNumber}...`);
    const subscriptionCheck = await hasActiveSubscription(clientNumber);
    
    if (!subscriptionCheck.active) {
      const errorCode = subscriptionCheck.status === 'expired' 
        ? 'SUBSCRIPTION_EXPIRED' 
        : subscriptionCheck.status === 'none'
        ? 'SUBSCRIPTION_REQUIRED'
        : 'SUBSCRIPTION_INVALID';
        
      return {
        success: false,
        error: {
          code: errorCode,
          message: subscriptionCheck.reason || 'Suscripción requerida para registrar mascotas',
          status: subscriptionCheck.status
        }
      };
    }

    console.log(`✅ Suscripción activa verificada para ${clientNumber}`);

    // --- BUSCAR O CREAR PERFIL ---
    let profileId: string;
    
    if (subscriptionCheck.profile) {
      // Ya tenemos el perfil de la validación de suscripción
      profileId = subscriptionCheck.profile.id;
    } else {
      // Caso edge: perfil no existía pero se creó en otro lugar
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", clientNumber)
        .maybeSingle();

      if (profileError) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: `Error buscando el perfil: ${profileError.message}`
          }
        };
      }

      if (!profile) {
        return {
          success: false,
          error: {
            code: 'SUBSCRIPTION_REQUIRED',
            message: 'Perfil no encontrado - debe registrarse y suscribirse primero'
          }
        };
      }

      profileId = profile.id;
    }

    // --- CREAR LA MASCOTA ---
    const { data: newPet, error: petError } = await supabase
      .from("pets")
      .insert({
        owner_id: profileId,
        name: petData.name.trim(),
        species: petData.species?.trim() || null,
        breed: petData.breed?.trim() || null,
        color: petData.color?.trim() || null,
        birth_date: petData.birth_date || null,
        gender: petData.gender?.trim() || null,
        photo_url: petData.photo_url?.trim() || null,
        distinguishing_marks: petData.distinguishing_marks?.trim() || null,
        is_currently_lost: false,
      })
      .select("id")
      .single();

    if (petError) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: `Error creando la mascota: ${petError.message}`
        }
      };
    }

    console.log(`🐾 Mascota creada exitosamente: ${newPet.id} para propietario: ${profileId}`);
    
    return {
      success: true,
      petId: newPet.id
    };

  } catch (error) {
    console.error("Error en createPet:", error);
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: `Error inesperado: ${error}`
      }
    };
  }
}

/**
 * Función para actualizar los datos del perfil del cliente
 * @param phoneNumber El número de teléfono del cliente (identificador único)
 * @param fullName Nombre completo del cliente
 * @param email Email del cliente
 * @param city Ciudad del cliente
 * @param country País del cliente
 * @returns Mensaje de confirmación o null si hubo un error
 */
export async function updateClientProfile(
  phoneNumber: string,
  fullName?: string,
  email?: string,
  city?: string,
  country?: string
): Promise<string | null> {
  try {
    // Validar que al menos un campo adicional sea proporcionado
    if (!fullName && !email && !city && !country) {
      throw new Error("Debe proporcionar al menos un campo para actualizar");
    }

    // Buscar el perfil existente por número de teléfono
    const { data: existingProfile, error: searchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (searchError) {
      throw new Error(`Error buscando el perfil: ${searchError.message}`);
    }

    if (!existingProfile) {
      throw new Error(
        `No se encontró un perfil con el número de teléfono: ${phoneNumber}`
      );
    }

    // Preparar los datos para actualizar (solo campos no vacíos)
    const updateData: any = {};
    if (fullName && fullName.trim() !== "")
      updateData.full_name = fullName.trim();
    if (email && email.trim() !== "") updateData.email = email.trim();
    if (city && city.trim() !== "") updateData.city = city.trim();
    if (country && country.trim() !== "") updateData.country = country.trim();

    // Actualizar el perfil
    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", existingProfile.id);

    if (updateError) {
      throw new Error(`Error actualizando el perfil: ${updateError.message}`);
    }

    console.log(`Perfil actualizado para el número: ${phoneNumber}`);

    // Crear mensaje de confirmación con los campos actualizados
    const updatedFields = [];
    if (updateData.full_name)
      updatedFields.push(`Nombre: ${updateData.full_name}`);
    if (updateData.email) updatedFields.push(`Email: ${updateData.email}`);
    if (updateData.city) updatedFields.push(`Ciudad: ${updateData.city}`);
    if (updateData.country) updatedFields.push(`País: ${updateData.country}`);

    return `Perfil actualizado exitosamente. ${updatedFields.join(", ")}`;
  } catch (error) {
    console.error("Error en updateClientProfile:", error);
    return null;
  }
}

/**
 * Función para obtener las mascotas de un propietario por número de teléfono
 * @param phoneNumber El número de teléfono del propietario
 * @returns Array de mascotas del propietario o null si hubo un error
 */
export async function getOwnerPets(phoneNumber: string): Promise<any[] | null> {
  try {
    // Buscar el perfil del propietario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Error buscando el perfil: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error(
        `No se encontró un perfil con el número de teléfono: ${phoneNumber}`
      );
    }

    // Obtener las mascotas del propietario
    const { data: pets, error: petsError } = await supabase
      .from("pets")
      .select("id, name, species, breed, gender, photo_url, is_currently_lost")
      .eq("owner_id", profile.id);

    if (petsError) {
      throw new Error(`Error obteniendo las mascotas: ${petsError.message}`);
    }

    return pets || [];
  } catch (error) {
    console.error("Error en getOwnerPets:", error);
    return null;
  }
}

/**
 * Función optimizada para obtener las mascotas de un propietario
 * Combina información de pets con alertas activas de active_lost_pets_details
 * @param phoneNumber El número de teléfono del propietario
 * @returns Array de mascotas del propietario con información de alertas o null si hubo un error
 */
export async function getOwnerPetsOptimized(phoneNumber: string): Promise<any[] | null> {
  try {
    // Obtener mascotas básicas del propietario
    const basicPets = await getOwnerPets(phoneNumber);
    if (!basicPets) {
      return null;
    }

    if (basicPets.length === 0) {
      return [];
    }

    // Obtener información de alertas activas para este propietario
    const { data: activePets, error: activeError } = await supabase
      .from("active_lost_pets_details")
      .select("pet_id, pet_name, alert_id, alert_status, last_seen_at")
      .eq("owner_phone", phoneNumber)
      .eq("alert_status", "active");

    if (activeError) {
      console.error("Error obteniendo alertas activas:", activeError);
      // En caso de error, devolver solo las mascotas básicas
      return basicPets;
    }

    // Combinar información: agregar datos de alertas a las mascotas básicas
    const enrichedPets = basicPets.map(pet => {
      const activeAlert = activePets?.find(active => active.pet_id === pet.id);
      
      return {
        ...pet,
        has_active_alert: !!activeAlert,
        alert_id: activeAlert?.alert_id || null,
        last_seen_at: activeAlert?.last_seen_at || null,
        is_currently_lost: !!activeAlert // Actualizar basado en alerta activa real
      };
    });

    console.log(`📊 Mascotas obtenidas: ${enrichedPets.length}, con alertas activas: ${activePets?.length || 0}`);
    return enrichedPets;
  } catch (error) {
    console.error("Error en getOwnerPetsOptimized:", error);
    return null;
  }
}

/**
 * Función para obtener solo las mascotas con alertas activas de un propietario
 * Usa directamente active_lost_pets_details para máximo rendimiento
 * @param phoneNumber El número de teléfono del propietario
 * @returns Array de mascotas con alertas activas o null si hubo un error
 */
export async function getOwnerActiveLostPets(phoneNumber: string): Promise<any[] | null> {
  try {
    console.log(`🔍 Obteniendo mascotas con alertas activas para: ${phoneNumber}`);

    const { data: activePets, error } = await supabase
      .from("active_lost_pets_details")
      .select(`
        pet_id,
        pet_name,
        species,
        breed,
        color,
        gender,
        pet_photo_url,
        distinguishing_marks,
        alert_id,
        alert_status,
        last_seen_at,
        last_seen_description,
        alert_notes,
        owner_name
      `)
      .eq("owner_phone", phoneNumber)
      .eq("alert_status", "active")
      .order("last_seen_at", { ascending: false });

    if (error) {
      console.error("❌ Error obteniendo mascotas con alertas activas:", error);
      return null;
    }

    console.log(`📊 Encontradas ${activePets?.length || 0} mascotas con alertas activas`);
    return activePets || [];
  } catch (error) {
    console.error("Error en getOwnerActiveLostPets:", error);
    return null;
  }
}

/**
 * Función para validar que una mascota pertenece a un propietario específico
 * @param phoneNumber El número de teléfono del propietario
 * @param petId El ID de la mascota a validar
 * @returns Objeto con información de la mascota si es válida, null si no
 */
export async function validatePetOwnership(
  phoneNumber: string,
  petId: string
): Promise<any | null> {
  try {
    // Buscar el perfil del propietario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Error buscando el perfil: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error(
        `No se encontró un perfil con el número de teléfono: ${phoneNumber}`
      );
    }

    // Validar que la mascota pertenece al propietario
    const { data: pet, error: petError } = await supabase
      .from("pets")
      .select("id, name, species, breed, gender, is_currently_lost")
      .eq("id", petId)
      .eq("owner_id", profile.id)
      .maybeSingle();

    if (petError) {
      throw new Error(`Error validando la mascota: ${petError.message}`);
    }

    return pet; // Retorna la mascota si existe y pertenece al propietario, null si no
  } catch (error) {
    console.error("Error en validatePetOwnership:", error);
    return null;
  }
}

/**
 * Función optimizada para validar que una mascota pertenece a un propietario específico
 * Primero busca en active_lost_pets_details (más rápido para mascotas con alertas),
 * luego hace fallback a la tabla pets
 * @param phoneNumber El número de teléfono del propietario
 * @param petId El ID de la mascota a validar
 * @returns Objeto con información de la mascota si es válida, null si no
 */
export async function validatePetOwnershipOptimized(
  phoneNumber: string,
  petId: string
): Promise<any | null> {
  try {
    // Primero intentar con active_lost_pets_details (más rápido para mascotas con alertas)
    const { data: activePet, error: activeError } = await supabase
      .from("active_lost_pets_details")
      .select("pet_id, pet_name, species, breed, gender, owner_phone")
      .eq("pet_id", petId)
      .eq("owner_phone", phoneNumber)
      .eq("alert_status", "active")
      .maybeSingle();

    if (!activeError && activePet) {
      console.log(`✅ Mascota encontrada en active_lost_pets_details: ${activePet.pet_name}`);
      return {
        id: activePet.pet_id,
        name: activePet.pet_name,
        species: activePet.species,
        breed: activePet.breed,
        gender: activePet.gender,
        is_currently_lost: true // Si está en active_lost_pets_details, está perdida
      };
    }

    // Fallback a la función original con tabla pets
    console.log(`🔄 Fallback a tabla pets para validar mascota ${petId}`);
    return await validatePetOwnership(phoneNumber, petId);
  } catch (error) {
    console.error("Error en validatePetOwnershipOptimized:", error);
    return null;
  }
}

/**
 * Función para crear una alerta de mascota perdida
 * @param phoneNumber El número de teléfono del propietario
 * @param petId El ID de la mascota perdida (opcional si solo tiene una mascota)
 * @param petName El nombre de la mascota (alternativa al ID)
 * @param alertData Datos de la alerta de pérdida
 * @returns El ID de la alerta creada o mensaje de error
 */
export async function createLostPetAlert(
  phoneNumber: string,
  alertData: LostPetAlertData,
  petId?: string,
  petName?: string
): Promise<string | null> {
  try {
    // Validar datos mínimos requeridos
    if (!alertData.last_seen_at) {
      throw new Error("La fecha y hora de la última vez vista es obligatoria");
    }

    // Validar formato de fecha
    const lastSeenDate = new Date(alertData.last_seen_at);
    if (isNaN(lastSeenDate.getTime())) {
      throw new Error("El formato de la fecha no es válido");
    }

    // Obtener las mascotas del propietario
    const ownerPets = await getOwnerPets(phoneNumber);
    if (!ownerPets) {
      throw new Error(
        "No se pudo obtener la información del propietario o sus mascotas"
      );
    }

    if (ownerPets.length === 0) {
      throw new Error("El propietario no tiene mascotas registradas");
    }

    let targetPet: any = null;

    // Si se proporciona un ID de mascota, validar que pertenece al propietario
    if (petId) {
      targetPet = await validatePetOwnership(phoneNumber, petId);
      if (!targetPet) {
        throw new Error(
          "La mascota especificada no existe o no pertenece a este propietario"
        );
      }
    }
    // Si se proporciona un nombre de mascota, buscarla entre las mascotas del propietario
    else if (petName) {
      const searchTerm = petName.toLowerCase().trim();

      // Buscar por nombre exacto primero
      let matchingPets = ownerPets.filter(
        (pet) => pet.name.toLowerCase() === searchTerm
      );

      // Si no se encuentra coincidencia exacta, buscar por coincidencias parciales
      if (matchingPets.length === 0) {
        matchingPets = ownerPets.filter(
          (pet) =>
            pet.name.toLowerCase().includes(searchTerm) ||
            (pet.species && pet.species.toLowerCase().includes(searchTerm)) ||
            (pet.breed && pet.breed.toLowerCase().includes(searchTerm)) ||
            `${pet.name.toLowerCase()} ${(
              pet.species || ""
            ).toLowerCase()}`.includes(searchTerm) ||
            `${pet.name.toLowerCase()} ${(
              pet.breed || ""
            ).toLowerCase()}`.includes(searchTerm)
        );
      }

      if (matchingPets.length === 0) {
        throw new Error(
          `No se encontró una mascota con el nombre "${petName}" para este propietario`
        );
      }

      if (matchingPets.length > 1) {
        const petDetails = matchingPets
          .map((p, index) => {
            const statusInfo = p.is_currently_lost
              ? " (YA REPORTADA COMO PERDIDA)"
              : "";
            return `${index + 1}. ${p.name} - ${
              p.species || "especie no especificada"
            } - ${p.breed || "raza no especificada"}${statusInfo}`;
          })
          .join("\n");
        throw new Error(
          `Se encontraron múltiples mascotas con el nombre "${petName}":\n\n${petDetails}\n\nPor favor, sea más específico indicando también la especie o raza, por ejemplo: "${petName} perro" o "${petName} gato".`
        );
      }

      targetPet = matchingPets[0];
    }
    // Si no se proporciona ID ni nombre, pero solo tiene una mascota, usar esa
    else if (ownerPets.length === 1) {
      targetPet = ownerPets[0];
    }
    // Si tiene múltiples mascotas y no especifica cuál, mostrar las opciones
    else {
      const petList = ownerPets
        .map((p) => {
          const statusInfo = p.is_currently_lost
            ? " (YA REPORTADA COMO PERDIDA)"
            : "";
          return `- ${p.name} (${
            p.species || "especie no especificada"
          })${statusInfo}`;
        })
        .join("\n");
      throw new Error(
        `Tiene múltiples mascotas registradas. Por favor especifique el nombre de la mascota que se perdió:\n\n${petList}\n\nEjemplo: Use el nombre exacto como "Max" o "Luna"`
      );
    }

    // Verificar si ya existe una alerta activa para esta mascota usando la tabla optimizada
    const { data: existingAlert, error: checkError } = await supabase
      .from("active_lost_pets_details")
      .select("alert_id, pet_name")
      .eq("pet_id", targetPet.id)
      .eq("alert_status", "active")
      .maybeSingle();

    if (checkError) {
      throw new Error(
        `Error verificando alertas existentes: ${checkError.message}`
      );
    }

    if (existingAlert) {
      throw new Error(
        `Ya existe una alerta activa para la mascota ${existingAlert.pet_name}`
      );
    }

    // Crear la alerta de mascota perdida
    // Nota: last_seen_location es un campo de geometría, por ahora lo incluimos en additional_info
    const locationInfo = alertData.last_seen_location?.trim();
    const additionalInfoText =
      [
        alertData.additional_info?.trim(),
        locationInfo ? `Ubicación: ${locationInfo}` : null,
      ]
        .filter(Boolean)
        .join(". ") || null;

    const { data: newAlert, error: alertError } = await supabase
      .from("lost_pet_alerts")
      .insert({
        pet_id: targetPet.id,
        last_seen_at: alertData.last_seen_at,
        last_seen_description: alertData.last_seen_description?.trim() || null,
        // last_seen_location: null, // Campo de geometría - por ahora no usado
        additional_info: additionalInfoText,
        status: "active",
      })
      .select("id")
      .single();

    if (alertError) {
      throw new Error(`Error creando la alerta: ${alertError.message}`);
    }

    // Actualizar el estado de la mascota a perdida
    const { error: updatePetError } = await supabase
      .from("pets")
      .update({ is_currently_lost: true })
      .eq("id", targetPet.id);

    if (updatePetError) {
      console.error(
        "Error actualizando el estado de la mascota:",
        updatePetError
      );
      // No fallar completamente, pero registrar el error
    }

    console.log(
      `Alerta de mascota perdida creada con ID: ${newAlert.id} para la mascota: ${targetPet.name}`
    );

    return `Alerta de mascota perdida creada exitosamente para ${targetPet.name}. ID de alerta: ${newAlert.id}. La mascota ha sido marcada como perdida en el sistema.`;
  } catch (error) {
    console.error("Error en createLostPetAlert:", error);
    return null;
  }
}

/**
 * Función para actualizar los datos de una mascota existente
 * @param phoneNumber El número de teléfono del propietario
 * @param petIdentifier El ID o nombre de la mascota a actualizar
 * @param petData Datos de la mascota a actualizar (todos opcionales excepto el identificador)
 * @returns Mensaje de confirmación o null si hubo un error
 */
export async function updatePet(
  phoneNumber: string,
  petIdentifier: string,
  petData: Partial<PetData>
): Promise<string | null> {
  try {
    // Validar que al menos un campo sea proporcionado para actualizar
    const fieldsToUpdate = Object.keys(petData).filter(
      key => petData[key as keyof PetData] !== undefined && 
             petData[key as keyof PetData] !== null && 
             petData[key as keyof PetData] !== ""
    );
    
    if (fieldsToUpdate.length === 0) {
      throw new Error("Debe proporcionar al menos un campo para actualizar");
    }

    // Buscar el perfil del propietario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Error buscando el perfil: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error(
        `No se encontró un perfil con el número de teléfono: ${phoneNumber}`
      );
    }

    // Buscar la mascota por ID o nombre
    let targetPet: any = null;
    
    // Primero intentar por ID si parece ser un UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(petIdentifier);
    
    if (isUUID) {
      const { data: petById, error: petByIdError } = await supabase
        .from("pets")
        .select("id, name, species, breed, color, birth_date, gender, photo_url, distinguishing_marks")
        .eq("id", petIdentifier)
        .eq("owner_id", profile.id)
        .maybeSingle();

      if (!petByIdError && petById) {
        targetPet = petById;
      }
    }

    // Si no se encontró por ID, buscar por nombre
    if (!targetPet) {
      const { data: pets, error: petsError } = await supabase
        .from("pets")
        .select("id, name, species, breed, color, birth_date, gender, photo_url, distinguishing_marks")
        .eq("owner_id", profile.id);

      if (petsError) {
        throw new Error(`Error buscando las mascotas: ${petsError.message}`);
      }

      if (!pets || pets.length === 0) {
        throw new Error("El propietario no tiene mascotas registradas");
      }

      // Buscar por nombre (coincidencia exacta)
      const matchingPets = pets.filter(
        pet => pet.name.toLowerCase() === petIdentifier.toLowerCase().trim()
      );

      if (matchingPets.length === 0) {
        // Buscar por coincidencia parcial
        const partialMatches = pets.filter(
          pet => pet.name.toLowerCase().includes(petIdentifier.toLowerCase().trim())
        );

        if (partialMatches.length === 0) {
          throw new Error(
            `No se encontró una mascota con el identificador "${petIdentifier}" para este propietario`
          );
        }

        if (partialMatches.length > 1) {
          const petList = partialMatches
            .map(p => `- ${p.name} (${p.species || "especie no especificada"})`)
            .join("\n");
          throw new Error(
            `Se encontraron múltiples mascotas que coinciden con "${petIdentifier}":\n\n${petList}\n\nPor favor, sea más específico con el nombre.`
          );
        }

        targetPet = partialMatches[0];
      } else if (matchingPets.length > 1) {
        const petList = matchingPets
          .map(p => `- ${p.name} (${p.species || "especie no especificada"})`)
          .join("\n");
        throw new Error(
          `Se encontraron múltiples mascotas con el nombre "${petIdentifier}":\n\n${petList}\n\nPor favor, proporcione el ID específico de la mascota.`
        );
      } else {
        targetPet = matchingPets[0];
      }
    }

    // Preparar los datos para actualizar
    const updateData: any = {};
    if (petData.name && petData.name.trim() !== "") {
      updateData.name = petData.name.trim();
    }
    if (petData.species && petData.species.trim() !== "") {
      updateData.species = petData.species.trim();
    }
    if (petData.breed && petData.breed.trim() !== "") {
      updateData.breed = petData.breed.trim();
    }
    if (petData.color && petData.color.trim() !== "") {
      updateData.color = petData.color.trim();
    }
    if (petData.birth_date && petData.birth_date.trim() !== "") {
      updateData.birth_date = petData.birth_date.trim();
    }
    if (petData.gender && petData.gender.trim() !== "") {
      updateData.gender = petData.gender.trim();
    }
    if (petData.photo_url && petData.photo_url.trim() !== "") {
      updateData.photo_url = petData.photo_url.trim();
    }
    if (petData.distinguishing_marks && petData.distinguishing_marks.trim() !== "") {
      updateData.distinguishing_marks = petData.distinguishing_marks.trim();
    }

    // Actualizar la mascota
    const { error: updateError } = await supabase
      .from("pets")
      .update(updateData)
      .eq("id", targetPet.id);

    if (updateError) {
      throw new Error(`Error actualizando la mascota: ${updateError.message}`);
    }

    console.log(`Mascota actualizada: ${targetPet.name} (ID: ${targetPet.id})`);

    // Crear mensaje de confirmación con los campos actualizados
    const updatedFields = [];
    if (updateData.name) updatedFields.push(`Nombre: ${updateData.name}`);
    if (updateData.species) updatedFields.push(`Especie: ${updateData.species}`);
    if (updateData.breed) updatedFields.push(`Raza: ${updateData.breed}`);
    if (updateData.color) updatedFields.push(`Color: ${updateData.color}`);
    if (updateData.birth_date) updatedFields.push(`Fecha de nacimiento: ${updateData.birth_date}`);
    if (updateData.gender) updatedFields.push(`Género: ${updateData.gender}`);
    if (updateData.photo_url) updatedFields.push(`Foto: ${updateData.photo_url}`);
    if (updateData.distinguishing_marks) updatedFields.push(`Marcas distintivas: ${updateData.distinguishing_marks}`);

    return `Mascota "${targetPet.name}" actualizada exitosamente. ${updatedFields.join(", ")}`;
  } catch (error) {
    console.error("Error en updatePet:", error);
    return null;
  }
}

/**
 * Función unificada para crear un avistamiento/reporte de mascota encontrada
 * Si se proporciona alertId, automáticamente hace el match y envía notificación
 * @param finderPhone Número de teléfono de quien encontró la mascota
 * @param finderName Nombre de quien encontró la mascota  
 * @param petDescription Descripción de la mascota encontrada
 * @param locationFound Ubicación donde se encontró
 * @param photoUrl URL de la foto de la mascota encontrada (opcional)
 * @param alertId ID de la alerta para hacer match automático (opcional)
 * @returns Objeto con resultado del avistamiento y match (si aplica) o null si hubo un error
 */
export async function createFoundPetSighting(
  finderPhone: string,
  finderName: string,
  petDescription: string,
  locationFound: string,
  photoUrl?: string,
  alertId?: string
): Promise<PetSightingResult | null> {
  try {
    console.log(`🔍 Creando avistamiento para finder: ${finderName} (${finderPhone})`);

    // Crear el avistamiento directamente con nombre y teléfono del finder
    const { data: newSighting, error: sightingError } = await supabase
      .from("sightings")
      .insert({
        alert_id: alertId || null, // Si hay alertId, asociarlo inmediatamente
        name: finderName.trim(),
        phone: finderPhone.trim(),
        sighted_at: new Date().toISOString(),
        location_description: locationFound.trim(),
        comment: petDescription.trim(),
        photo_url: photoUrl?.trim() || null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sightingError) {
      throw new Error(`Error creando el avistamiento: ${sightingError.message}`);
    }

    console.log(`✅ Avistamiento de mascota encontrada creado con ID: ${newSighting.id}`);

    // Preparar resultado base
    const result: PetSightingResult = {
      success: true,
      sightingId: newSighting.id,
      isMatch: !!alertId,
      notificationSent: false,
      notificationError: null,
      pet: null,
      owner: null,
      finder: {
        name: finderName,
        phone: finderPhone,
        location: locationFound,
        description: petDescription,
        photoUrl: photoUrl || null
      }
    };

    // Si no hay alertId, es solo un avistamiento sin match
    if (!alertId) {
      console.log(`📝 Avistamiento registrado sin match. ID: ${newSighting.id}`);
      return result;
    }

    // Si hay alertId, hacer el match automático y enviar notificación
    console.log(`🔗 Procesando match automático con alerta: ${alertId}`);

    // Validar que el alertId sea un UUID válido
    if (!isValidUUID(alertId)) {
      throw new Error(`El ID de la alerta no es válido: ${alertId}`);
    }

    try {
      // Obtener información de la mascota y alerta
      const { data: alertData, error: alertError } = await supabase
        .from("lost_pet_alerts")
        .select(`id, pet_id`)
        .eq("id", alertId)
        .single();

      if (alertError) {
        throw new Error(`Error obteniendo datos de la alerta: ${alertError.message}`);
      }

      // Obtener información de la mascota
      const { data: petData, error: petError } = await supabase
        .from("pets")
        .select(`name, species, breed, owner_id`)
        .eq("id", alertData.pet_id)
        .single();

      if (petError) {
        throw new Error(`Error obteniendo datos de la mascota: ${petError.message}`);
      }

      // Obtener información del dueño
      const { data: ownerData, error: ownerError } = await supabase
        .from("profiles")
        .select("full_name, phone_number")
        .eq("id", petData.owner_id)
        .single();

      if (ownerError) {
        throw new Error(`Error obteniendo datos del dueño: ${ownerError.message}`);
      }

      // Agregar información del match al resultado
      result.pet = {
        name: petData.name,
        species: petData.species,
        breed: petData.breed
      };
      result.owner = {
        name: ownerData.full_name || 'No especificado',
        phone: ownerData.phone_number
      };

      // Enviar notificación de Twilio automáticamente
      try {
        console.log(`📱 Enviando notificación automática a ${ownerData.phone_number}...`);
        
        await sendPetSightingNotification(
          ownerData.phone_number,
          ownerData.full_name || 'Propietario',
          petData.name,
          finderName,
          finderPhone
        );
        
        result.notificationSent = true;
        console.log(`✅ Notificación enviada exitosamente`);
        
      } catch (notificationError: any) {
        console.error(`❌ Error enviando notificación:`, notificationError);
        result.notificationError = notificationError.message;
      }

      console.log(`🎯 Match confirmado entre avistamiento ${newSighting.id} y alerta ${alertId}`);
      
    } catch (matchError: any) {
      console.error(`❌ Error en el match automático:`, matchError);
      result.notificationError = `Error en match: ${matchError.message}`;
    }

    return result;

  } catch (error) {
    console.error("Error en createFoundPetSighting:", error);
    return null;
  }
}

//todo --------------------------------------------------------------
/**
 * Función para confirmar el match y notificar al dueño
 * @param sightingId ID del avistamiento
 * @param alertId ID de la alerta de mascota perdida
 * @returns Objeto con información del match y resultado de la notificación o null si hubo un error
 */
export async function confirmPetMatch(
  sightingId: string,
  alertId: string
): Promise<any | null> {
  try {
    // Validar que los IDs sean UUIDs válidos
    if (!isValidUUID(sightingId)) {
      throw new Error(`El ID del avistamiento no es válido. Se recibió: "${sightingId}". Por favor, asegúrese de registrar primero el avistamiento con createFoundPetSightingTool para obtener un ID válido.`);
    }

    if (!isValidUUID(alertId)) {
      throw new Error(`El ID de la alerta no es válido. Se recibió: "${alertId}". Por favor, verifique que el ID de la alerta sea correcto.`);
    }

    // Actualizar el avistamiento con el alert_id confirmado
    const { error: updateError } = await supabase
      .from("sightings")
      .update({ alert_id: alertId })
      .eq("id", sightingId);

    if (updateError) {
      throw new Error(`Error actualizando el avistamiento: ${updateError.message}`);
    }

    // Obtener información del avistamiento incluyendo datos del finder
    const { data: sightingData, error: sightingError } = await supabase
      .from("sightings")
      .select(`
        id,
        location_description,
        comment,
        photo_url,
        sighted_at,
        name,
        phone
      `)
      .eq("id", sightingId)
      .single();

    if (sightingError) {
      throw new Error(`Error obteniendo datos del avistamiento: ${sightingError.message}`);
    }

    // Obtener información de la mascota y alerta
    const { data: alertData, error: alertError } = await supabase
      .from("lost_pet_alerts")
      .select(`
        id,
        pet_id
      `)
      .eq("id", alertId)
      .single();

    if (alertError) {
      throw new Error(`Error obteniendo datos de la alerta: ${alertError.message}`);
    }

    // Obtener información de la mascota
    const { data: petData, error: petError } = await supabase
      .from("pets")
      .select(`
        name,
        species,
        breed,
        owner_id
      `)
      .eq("id", alertData.pet_id)
      .single();

    if (petError) {
      throw new Error(`Error obteniendo datos de la mascota: ${petError.message}`);
    }

    // Obtener información del dueño
    const { data: ownerData, error: ownerError } = await supabase
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", petData.owner_id)
      .single();

    if (ownerError) {
      throw new Error(`Error obteniendo datos del dueño: ${ownerError.message}`);
    }

    // Preparar datos estructurados para retornar
    const matchResult = {
      success: true,
      pet: {
        name: petData.name,
        species: petData.species,
        breed: petData.breed
      },
      owner: {
        name: ownerData.full_name || 'No especificado',
        phone: ownerData.phone_number
      },
      finder: {
        name: sightingData.name || 'No especificado',
        phone: sightingData.phone,
        location: sightingData.location_description,
        description: sightingData.comment,
        photoUrl: sightingData.photo_url,
        sightedAt: sightingData.sighted_at
      },
      notificationSent: false,
      notificationError: null
    };

    // Enviar notificación de Twilio automáticamente
    try {
      console.log(`📱 Enviando notificación automática a ${ownerData.phone_number}...`);
      
      await sendPetSightingNotification(
        ownerData.phone_number,
        ownerData.full_name || 'Propietario',
        petData.name,
        sightingData.name,
        sightingData.phone
      );
      
      matchResult.notificationSent = true;
      console.log(`✅ Notificación enviada exitosamente`);
      
    } catch (notificationError: any) {
      console.error(`❌ Error enviando notificación:`, notificationError);
      matchResult.notificationError = notificationError.message;
    }

    console.log(`Match confirmado entre avistamiento ${sightingId} y alerta ${alertId}`);
    return matchResult;

  } catch (error) {
    console.error("Error en confirmPetMatch:", error);
    return null;
  }
}

/**
 * Función para enviar notificación de avistamiento de mascota perdida a través de Twilio
 * @param ownerPhone Número de teléfono del dueño de la mascota
 * @param ownerName Nombre del dueño de la mascota
 * @param petName Nombre de la mascota
 * @param finderName Nombre de la persona que encontró la mascota (opcional para template actual)
 * @param finderPhone Teléfono de la persona que encontró la mascota (opcional para template actual)
 * @returns void
 */
export const sendPetSightingNotification = async (
  ownerPhone: string,
  ownerName: string,
  petName: string,
  finderName?: string,
  finderPhone?: string
): Promise<void> => {
  try {
    const templateUrl = "https://ultim.online/olfatea/send-template";
    const testTemplateUrl = "http://localhost:3025/olfatea/send-template";

    // Template provisional - solo requiere nombre del dueño y nombre de la mascota
    const templateId = "HXcb06d9cb9511eb3bdf2eaaaa02f1a1a3";

    const requestData = {
      to: ownerPhone,
      templateId: templateId,
      ownerName: ownerName || "Dueño",
      petName: petName || "Mascota",
      // Datos del finder son opcionales en el template actual
      finderName: finderName || "Alguien",
      finderPhone: finderPhone || "No proporcionado",
      twilioPhoneNumber: "+14707406662" // Número de Twilio de prueba
    };

    // Si se proporcionan datos del finder, los incluimos para futuro uso
    if (finderName && finderPhone) {
      console.log(`📝 Datos del finder disponibles: ${finderName} (${finderPhone}) - Listos para nuevo template`);
    }

    const response = await axios.post(testTemplateUrl, requestData);

    console.log(`✅ Notificación de avistamiento enviada exitosamente a ${ownerPhone}:`, response.data);
    console.log(`📱 Template usado: ${templateId} - Dueño: ${ownerName}, Mascota: ${petName}`);
  } catch (error: any) {
    if (error.response) {
      console.error(`❌ Error enviando notificación de avistamiento:`, error.response.data);
    } else if (error.request) {
      console.error(`❌ No response from server:`, error.request);
    } else {
      console.error(`❌ Error:`, error.message);
    }
    
    // Re-lanzar el error para que el caller pueda manejarlo
    throw new Error(`Error enviando notificación: ${error.message}`);
  }
};

//! Prueba de consulta con Supabase Function
/**
 * Llama a la función RPC 'search_lost_pets_by_text' en Supabase para buscar mascotas perdidas.
 * @param userDescription La descripción en lenguaje natural de la mascota encontrada.
 * @returns Un objeto con los resultados o un error.
 */
export async function searchLostPetsFTS(userDescription: string): Promise<any> {
  console.log(`🔎 Ejecutando búsqueda FTS en Supabase con: "${userDescription}"`);

  if (!userDescription || userDescription.trim() === "") {
    return { error: "La descripción para buscar no puede estar vacía." };
  }

  const { data: matches, error } = await supabase.rpc('search_lost_pets_by_text', {
    search_text: userDescription,
    match_count: 3, // Traemos los 3 mejores resultados
  });

  if (error) {
    console.error("Error en la búsqueda Full-Text Search:", error);
    return { error: "Hubo un error técnico al realizar la búsqueda." };
  }

  if (!matches || matches.length === 0) {
    console.log("✅ Búsqueda FTS completada sin resultados.");
    return { results: [], message: "No se encontraron mascotas que coincidan." };
  }

  console.log(`✅ Búsqueda FTS exitosa. Se encontraron ${matches.length} resultados.`);
  
  return {
    results: matches,
    message: `Se encontraron ${matches.length} posibles coincidencias.`
  };
}

//! ================== FUNCIONES DE SUSCRIPCIÓN ==================

// Interfaz para el resultado de validación de perfil completo
interface ProfileValidationResult {
  isComplete: boolean;
  missingFields: string[];
  profile: {
    id: string;
    phone_number: string;
    full_name?: string;
    email?: string;
    city?: string;
    country?: string;
    neighborhood?: string;
    subscription_status?: string;
  } | null;
}

// Interfaz para el resultado de iniciar proceso de suscripción
interface SubscriptionProcessResult {
  success: boolean;
  profileComplete: boolean;
  missingFields: string[];
  bankInfo: {
    bank: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
    nit: string;
    amount: string;
    concept: string;
  };
  message: string;
}

// Interfaz para el resultado de procesar comprobante de pago
interface PaymentProofResult {
  success: boolean;
  adminNotified: boolean;
  subscriptionStatus: string;
  message: string;
  error?: string;
}

/**
 * Función para validar si el perfil de un usuario está completo para suscribirse
 * @param phoneNumber El número de teléfono del usuario
 * @returns Objeto con estado del perfil y campos faltantes
 */
export async function validateCompleteProfile(phoneNumber: string): Promise<ProfileValidationResult> {
  try {
    console.log(`🔍 Validando perfil completo para ${phoneNumber}...`);

    // Buscar el perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, phone_number, full_name, email, city, country, neighborhood, subscription_status")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Error buscando el perfil: ${profileError.message}`);
    }

    if (!profile) {
      console.log(`❌ No se encontró perfil para ${phoneNumber}`);
      return {
        isComplete: false,
        missingFields: ["full_name", "email", "city", "country", "neighborhood"],
        profile: null
      };
    }

    // Definir campos obligatorios para suscripción
    const requiredFields = [
      { field: "full_name", value: profile.full_name },
      { field: "email", value: profile.email },
      { field: "city", value: profile.city },
      { field: "country", value: profile.country },
      { field: "neighborhood", value: profile.neighborhood }
    ];

    // Identificar campos faltantes
    const missingFields = requiredFields
      .filter(({ value }) => !value || value.trim() === "")
      .map(({ field }) => field);

    const isComplete = missingFields.length === 0;

    console.log(`✅ Validación de perfil completa. Completo: ${isComplete}, Campos faltantes: ${missingFields.join(", ")}`);

    return {
      isComplete,
      missingFields,
      profile
    };

  } catch (error) {
    console.error("Error en validateCompleteProfile:", error);
    return {
      isComplete: false,
      missingFields: ["full_name", "email", "city", "country", "neighborhood"],
      profile: null
    };
  }
}

/**
 * Función para iniciar el proceso de suscripción
 * @param phoneNumber El número de teléfono del usuario
 * @returns Objeto con información del proceso y datos bancarios
 */
export async function initiateSubscriptionProcess(phoneNumber: string): Promise<SubscriptionProcessResult> {
  try {
    console.log(`🚀 Iniciando proceso de suscripción para ${phoneNumber}...`);

    // Validar perfil completo
    const profileValidation = await validateCompleteProfile(phoneNumber);

    // Información bancaria provisional para pruebas
    const bankInfo = {
      bank: "Bancolombia",
      accountType: "Cuenta de Ahorros",
      accountNumber: "123-456-789-01",
      accountHolder: "Olfatea SAS",
      nit: "123.456.789-1",
      amount: "$26,000 COP",
      concept: "Suscripción Anual Olfatea"
    };

    if (!profileValidation.isComplete) {
      console.log(`⚠️ Perfil incompleto. Campos faltantes: ${profileValidation.missingFields.join(", ")}`);
      return {
        success: false,
        profileComplete: false,
        missingFields: profileValidation.missingFields,
        bankInfo,
        message: `Para continuar con la suscripción, necesito que completes tu información de perfil. Faltan los siguientes datos: ${profileValidation.missingFields.join(", ")}.`
      };
    }

    console.log(`✅ Perfil completo. Mostrando información de pago...`);

    return {
      success: true,
      profileComplete: true,
      missingFields: [],
      bankInfo,
      message: "Tu perfil está completo. Aquí tienes la información para realizar el pago de la suscripción anual ($26,000 COP)."
    };

  } catch (error) {
    console.error("Error en initiateSubscriptionProcess:", error);
    return {
      success: false,
      profileComplete: false,
      missingFields: ["full_name", "email", "city", "country", "neighborhood"],
      bankInfo: {
        bank: "Bancolombia",
        accountType: "Cuenta de Ahorros", 
        accountNumber: "123-456-789-01",
        accountHolder: "Olfatea SAS",
        nit: "123.456.789-1",
        amount: "$26,000 COP",
        concept: "Suscripción Anual Olfatea"
      },
      message: `Error técnico iniciando el proceso de suscripción: ${error}`
    };
  }
}

/**
 * Función para procesar el comprobante de pago y notificar al admin
 * @param phoneNumber El número de teléfono del usuario
 * @param proofImageUrl La URL de la imagen del comprobante
 * @returns Objeto con resultado del procesamiento
 */
export async function processPaymentProof(
  phoneNumber: string,
  proofImageUrl: string
): Promise<PaymentProofResult> {
  try {
    console.log(`🧾 Procesando comprobante de pago para ${phoneNumber}...`);

    // Validar URL de imagen
    if (!proofImageUrl || !proofImageUrl.trim()) {
      return {
        success: false,
        adminNotified: false,
        subscriptionStatus: "inactive",
        message: "La URL del comprobante es requerida.",
        error: "URL de imagen faltante"
      };
    }

    // Validar que sea una URL válida
    try {
      new URL(proofImageUrl);
    } catch {
      return {
        success: false,
        adminNotified: false,
        subscriptionStatus: "inactive",
        message: "La URL del comprobante no es válida.",
        error: "URL de imagen inválida"
      };
    }

    // Obtener datos completos del perfil
    const profileValidation = await validateCompleteProfile(phoneNumber);

    if (!profileValidation.profile) {
      return {
        success: false,
        adminNotified: false,
        subscriptionStatus: "inactive",
        message: "No se encontró el perfil del usuario.",
        error: "Perfil no encontrado"
      };
    }

    if (!profileValidation.isComplete) {
      return {
        success: false,
        adminNotified: false,
        subscriptionStatus: "inactive",
        message: `Perfil incompleto. Faltan: ${profileValidation.missingFields.join(", ")}`,
        error: "Perfil incompleto"
      };
    }

    // Actualizar estado de suscripción a "pending"
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ subscription_status: "pending" })
      .eq("phone_number", phoneNumber);

    if (updateError) {
      throw new Error(`Error actualizando estado de suscripción: ${updateError.message}`);
    }

    // Enviar notificación al admin
    let adminNotified = false;
    try {
      await sendAdminNotificationEmail(profileValidation.profile, proofImageUrl);
      adminNotified = true;
      console.log(`📧 Admin notificado exitosamente para ${phoneNumber}`);
    } catch (emailError) {
      console.error("Error enviando email al admin:", emailError);
      // No fallar todo el proceso por error de email
    }

    console.log(`✅ Comprobante procesado exitosamente para ${phoneNumber}`);

    return {
      success: true,
      adminNotified,
      subscriptionStatus: "pending",
      message: `¡Perfecto! He recibido tu comprobante de pago. ${adminNotified ? 'He notificado al equipo administrativo' : 'Estoy notificando al equipo administrativo'} para que validen el pago y activen tu suscripción. Esto puede tomar entre 24-48 horas hábiles. Te confirmaremos por este medio cuando esté lista.`
    };

  } catch (error) {
    console.error("Error en processPaymentProof:", error);
    return {
      success: false,
      adminNotified: false,
      subscriptionStatus: "inactive",
      message: `Error técnico procesando el comprobante: ${error}`,
      error: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}

/**
 * Función para enviar email de notificación al admin sobre nueva suscripción pendiente
 * @param profileData Datos del perfil del usuario
 * @param proofImageUrl URL de la imagen del comprobante
 * @returns void
 */
export async function sendAdminNotificationEmail(
  profileData: any,
  proofImageUrl: string
): Promise<void> {
  try {
    console.log(`📧 Enviando notificación de suscripción al admin...`);

    // Configurar transporter de nodemailer con SendGrid
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || "587"),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // HTML template para el email
    const emailHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nueva Suscripción Pendiente - Olfatea</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
        .user-info { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .info-row { display: flex; margin: 10px 0; }
        .info-label { font-weight: bold; min-width: 120px; }
        .proof-section { background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { background-color: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🐾 Nueva Suscripción Pendiente - Olfatea</h1>
        </div>
        
        <div class="content">
          <p><strong>¡Tienes una nueva solicitud de suscripción para validar!</strong></p>
          
          <div class="user-info">
            <h3>📋 Datos del Usuario</h3>
            <div class="info-row">
              <span class="info-label">Nombre Completo:</span>
              <span>${profileData.full_name || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Teléfono:</span>
              <span>${profileData.phone_number}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span>${profileData.email || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Ciudad:</span>
              <span>${profileData.city || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">País:</span>
              <span>${profileData.country || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Barrio:</span>
              <span>${profileData.neighborhood || 'No especificado'}</span>
            </div>
          </div>

          <div class="proof-section">
            <h3>🧾 Comprobante de Pago</h3>
            <p>El usuario ha enviado el siguiente comprobante de pago:</p>
            <a href="${proofImageUrl}" target="_blank" class="button">Ver Comprobante de Pago</a>
            <p><small>URL: ${proofImageUrl}</small></p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h4>⚡ Acciones a Realizar:</h4>
            <ol>
              <li>Verificar el comprobante de pago haciendo clic en el botón superior</li>
              <li>Validar que el monto sea de $26,000 COP</li>
              <li>Confirmar que el pago haya llegado a la cuenta de Olfatea</li>
              <li>Si todo está correcto, activar la suscripción en el panel administrativo</li>
              <li>Notificar al usuario vía WhatsApp sobre la activación</li>
            </ol>
          </div>

          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8; margin-top: 20px;">
            <h4>💰 Detalles de la Suscripción:</h4>
            <p><strong>Plan:</strong> Suscripción Anual Olfatea<br>
            <strong>Monto:</strong> $26,000 COP<br>
            <strong>Duración:</strong> 12 meses<br>
            <strong>Estado Actual:</strong> Pendiente de Validación</p>
          </div>
        </div>

        <div class="footer">
          <p>Este es un mensaje automático del sistema de suscripciones de Olfatea.<br>
          Por favor, procesa esta solicitud lo antes posible.</p>
          <small>Fecha: ${new Date().toLocaleString('es-CO')}</small>
        </div>
      </div>
    </body>
    </html>`;

    // Configurar opciones del email
    const mailOptions = {
      from: '"Olfatea - Sistema Automático" <sistema@olfatea.com>',
      to: process.env.ADMIN_EMAIL || "admin@olfatea.com",
      cc: [
        // Puedes agregar más destinatarios aquí si es necesario
      ],
      subject: `🐾 Nueva Suscripción Pendiente - ${profileData.full_name || 'Usuario'} (${profileData.phone_number})`,
      html: emailHtml
    };

    // Enviar el email
    await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email de notificación enviado exitosamente al admin`);

  } catch (error: any) {
    console.error(`❌ Error enviando email de notificación al admin:`, error);
    throw new Error(`Error enviando email de notificación: ${error.message}`);
  }
}