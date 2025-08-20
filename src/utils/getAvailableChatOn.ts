// Guardar hustorial de conversación en Supabase
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseKey);

// Función para consultar si una persona esta disponible para chat automático
export async function getAvailableChatOn(clientNumber: string) {
  try {
    // Primero buscar el profile del usuario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", clientNumber)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      throw new Error(`Error fetching profile: ${profileError.message}`);
    }

    // Si no existe el perfil, habilitar chat automático
    if (!profile) {
      return false;
    }

    // Buscar la configuración de chat para este usuario
    const { data: chatHistory, error: chatError } = await supabase
      .from("chat_history")
      .select("chat_on")
      .eq("user_id", profile.id)
      .single();

    if (chatError && chatError.code !== "PGRST116") {
      throw new Error(`Error fetching chat config: ${chatError.message}`);
    }

    // Si existe configuración, devolver el valor de chat_on
    if (chatHistory) {
      return chatHistory.chat_on || false;
    }

    // Si no existe configuración, habilitar chat automático (retornar false)
    return false;
  } catch (error) {
    console.error(error);
    // En caso de error, habilitar chat automático
    return false;
  }
}
