// Guardar hustorial de conversación en Supabase
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseKey);

// Función para Actualizar si el cliente queire o no audios
export async function setAvailableForAudio(
  clientNumber: string,
  isAvailableForAudio: boolean
): Promise<string> {
  try {
    // Verificar si el cliente ya tiene un chat
    const { data: existingChat, error: fetchError } = await supabase
      .from("chat_history")
      .select("id")
      .eq("client_number", clientNumber)
      .single();
    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116: No rows found
      throw new Error(`Error fetching data: ${fetchError.message}`);
    }

    if (existingChat) {
      // Si el cliente ya tiene un chat, agregar el nuevo mensaje al historial existente
      const { error: updateError } = await supabase
        .from("chat_history")
        .update({ audio: isAvailableForAudio })
        .eq("id", existingChat.id);

      if (updateError) {
        throw new Error(`Error updating data: ${updateError.message}`);
        return "error";
      } else {
        console.log("Data updated successfully");
        return "deacuerdo";
      }
    }
  } catch (error) {
    console.error(error);
    return "error";
  }

  return "exito";
}
