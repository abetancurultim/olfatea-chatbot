import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
// Import colombia.json file

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseKey);

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

/**
 * Función para crear una mascota asociada a un usuario por número de teléfono
 * @param clientNumber El número de teléfono del propietario
 * @param petData Datos de la mascota (mínimo: nombre)
 * @returns El ID de la mascota creada o null si hubo un error
 */
export async function createPet(
  clientNumber: string,
  petData: PetData
): Promise<string | null> {
  try {
    // Validar datos mínimos requeridos
    if (!petData.name || petData.name.trim() === "") {
      throw new Error("El nombre de la mascota es obligatorio");
    }

    // --- PASO 1: Buscar o crear el perfil del usuario ---
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", clientNumber)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Error buscando el perfil: ${profileError.message}`);
    }

    if (!profile) {
      console.log(
        `Perfil no encontrado para ${clientNumber}. Creando uno nuevo...`
      );

      // Crear perfil directamente sin autenticación de Supabase
      const generatedId = uuidv4();

      const { data: newProfile, error: newProfileError } = await supabase
        .from("profiles")
        .insert({
          id: generatedId,
          phone_number: clientNumber,
        })
        .select("id")
        .single();

      if (newProfileError) {
        throw new Error(`Error creando el perfil: ${newProfileError.message}`);
      }

      profile = newProfile;
      console.log(`Perfil creado con ID: ${profile.id}`);
    }

    const ownerId = profile.id;

    // --- PASO 2: Crear la mascota ---
    const { data: newPet, error: petError } = await supabase
      .from("pets")
      .insert({
        owner_id: ownerId,
        name: petData.name.trim(),
        species: petData.species?.trim() || null,
        breed: petData.breed?.trim() || null,
        color: petData.color?.trim() || null,
        birth_date: petData.birth_date || null,
        gender: petData.gender?.trim() || null,
        photo_url: petData.photo_url?.trim() || null,
        distinguishing_marks: petData.distinguishing_marks?.trim() || null,
        is_currently_lost: false, // Por defecto, la mascota no está perdida
      })
      .select("id")
      .single();

    if (petError) {
      throw new Error(`Error creando la mascota: ${petError.message}`);
    }

    console.log(
      `Mascota creada con ID: ${newPet.id} para el propietario: ${ownerId}`
    );
    return newPet.id;
  } catch (error) {
    console.error("Error en createPet:", error);
    return null;
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

    // Agregar timestamp de actualización
    updateData.updated_at = new Date().toISOString();

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
      .select("id, name, species, breed, gender, is_currently_lost")
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

    // Verificar si la mascota ya está reportada como perdida
    if (targetPet.is_currently_lost) {
      throw new Error(
        `La mascota ${targetPet.name} ya está reportada como perdida`
      );
    }

    // Verificar si ya existe una alerta activa para esta mascota
    const { data: existingAlert, error: checkError } = await supabase
      .from("lost_pet_alerts")
      .select("id")
      .eq("pet_id", targetPet.id)
      .eq("status", "active")
      .maybeSingle();

    if (checkError) {
      throw new Error(
        `Error verificando alertas existentes: ${checkError.message}`
      );
    }

    if (existingAlert) {
      throw new Error(
        `Ya existe una alerta activa para la mascota ${targetPet.name}`
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
