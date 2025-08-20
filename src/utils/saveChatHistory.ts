// Guardar historial de conversación en Supabase (Versión Final con Hilo Único)
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

// Conexión a Supabase
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Guarda un mensaje en la base de datos, asegurando un único hilo de conversación por usuario (estilo WhatsApp).
 * Se encarga de encontrar o crear el perfil del usuario y su conversación asociada.
 * @param clientNumber El número de teléfono del usuario.
 * @param newMessage El contenido del mensaje a guardar.
 * @param sender El emisor del mensaje ('user' o 'bot').
 * @param mediaUrl URL opcional de un archivo multimedia.
 * @param twilioSid SID opcional de Twilio para trazabilidad.
 * @returns El ID del mensaje guardado o null si hubo un error.
 */
export async function savePetAppMessage(
  clientNumber: string,
  newMessage: string,
  sender: "user" | "bot",
  mediaUrl?: string,
  twilioSid?: string
): Promise<string | null> {
  try {
    // --- PASO 1: Asegurar que el perfil del usuario exista (Find or Create Profile) ---
    // Esta lógica se mantiene, es correcta.
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

    const userId = profile.id;

    // --- PASO 2: Asegurar que la conversación exista (Find or Create Chat History) ---
    // Lógica simplificada para un hilo único.
    let { data: chatHistory, error: chatError } = await supabase
      .from("chat_history")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (chatError) {
      throw new Error(
        `Error buscando el historial de chat: ${chatError.message}`
      );
    }

    // Si no existe un historial de chat para este usuario, se crea uno.
    // Esto solo ocurrirá UNA VEZ en la vida del usuario: con su primer mensaje.
    if (!chatHistory) {
      console.log(
        `Creando historial de chat permanente para el usuario ${userId}`
      );
      const { data: newChat, error: newChatError } = await supabase
        .from("chat_history")
        .insert({ user_id: userId })
        .select("id")
        .single();

      if (newChatError) {
        throw new Error(
          `Error creando el nuevo historial de chat: ${newChatError.message}`
        );
      }
      chatHistory = newChat;
    }

    const chatId = chatHistory.id;

    // --- PASO 3: Insertar el mensaje en la tabla 'messages' ---
    // Esta lógica ya era correcta.
    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender: sender,
        content: newMessage,
        media_url: mediaUrl || null,
        twilio_sid: twilioSid || null,
      })
      .select("id")
      .single();

    if (messageError) {
      throw new Error(`Error insertando el mensaje: ${messageError.message}`);
    }

    console.log(
      `Mensaje ${messageData.id} guardado en el chat PERMANENTE ${chatId}`
    );
    return messageData.id;
  } catch (error) {
    console.error("Error en savePetAppMessage:", error);
    return null;
  }
}
