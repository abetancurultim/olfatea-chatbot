import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  testFunction,
  createPet,
  updateClientProfile,
  createLostPetAlert,
  getOwnerPets,
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
  additionalInfo: z.string().optional(),
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
  async ({ clientNumber, name, species, breed, gender }) => {
    // Crear objeto PetData con los datos básicos
    const petData: PetData = {
      name: name.trim(),
      species: species?.trim() || undefined,
      breed: breed?.trim() || undefined,
      gender: gender?.trim() || undefined,
    };

    const petId = await createPet(clientNumber, petData);

    if (petId) {
      return `Mascota creada exitosamente con ID: ${petId}. Nombre: ${
        petData.name
      }${petData.species ? `, Especie: ${petData.species}` : ""}${
        petData.breed ? `, Raza: ${petData.breed}` : ""
      }${petData.gender ? `, Género: ${petData.gender}` : ""}`;
    } else {
      return "Error: No se pudo crear la mascota. Verifique los datos proporcionados.";
    }
  },
  {
    name: "createPetTool",
    description:
      "Crea una mascota asociada a un usuario por número de teléfono. Requiere al menos el nombre de la mascota. Los campos especie, raza y género son opcionales.",
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
    additionalInfo,
  }) => {
    // Validar formato de fecha básico
    if (lastSeenAt && lastSeenAt.trim() !== "") {
      const dateTest = new Date(lastSeenAt.trim());
      if (isNaN(dateTest.getTime())) {
        return "Error: El formato de la fecha no es válido. Use formato ISO (ej: 2024-01-15T10:30:00Z) o un formato reconocible.";
      }
    }

    const alertData = {
      last_seen_at: lastSeenAt.trim(),
      last_seen_description: lastSeenDescription?.trim() || undefined,
      last_seen_location: lastSeenLocation?.trim() || undefined,
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
      "Crea una alerta de mascota perdida para un propietario por número de teléfono. Requiere la fecha/hora de última vez vista. Si el propietario tiene múltiples mascotas, debe especificar el nombre de la mascota. Si solo tiene una mascota, se selecciona automáticamente. Los campos de descripción, ubicación e información adicional son opcionales.",
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
        return `- ${pet.name}${lostStatus}\n  Especie: ${
          pet.species || "No especificada"
        }\n  Raza: ${pet.breed || "No especificada"}\n  Género: ${
          pet.gender || "No especificado"
        }`;
      })
      .join("\n\n");

    return `Mascotas registradas para este propietario:\n\n${petList}`;
  },
  {
    name: "getOwnerPetsTool",
    description:
      "Obtiene la lista de mascotas registradas para un propietario por número de teléfono. Útil para ver las mascotas disponibles antes de crear una alerta de pérdida.",
    schema: z.object({
      phoneNumber: z.string().min(1, "El número de teléfono es obligatorio"),
    }),
  }
);
