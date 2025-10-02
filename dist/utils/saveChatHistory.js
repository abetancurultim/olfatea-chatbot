var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Guardar historial de conversación en Supabase (Versión Final con Hilo Único)
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();
// Conexión a Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);
const CHAT_HISTORY_TABLE = "chat_history";
const MESSAGES_TABLE = "messages";
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
export function savePetAppMessage(clientNumber, newMessage, sender, mediaUrl, twilioSid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // --- PASO 1: Asegurar que el perfil del usuario exista (Find or Create Profile) ---
            // Esta lógica se mantiene, es correcta.
            let { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id")
                .eq("phone_number", clientNumber)
                .maybeSingle();
            if (profileError) {
                throw new Error(`Error buscando el perfil: ${profileError.message}`);
            }
            if (!profile) {
                console.log(`Perfil no encontrado para ${clientNumber}. Creando uno nuevo...`);
                // Crear perfil directamente sin autenticación de Supabase
                const generatedId = uuidv4();
                const { data: newProfile, error: newProfileError } = yield supabase
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
            let { data: chatHistory, error: chatError } = yield supabase
                .from("chat_history")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();
            if (chatError) {
                throw new Error(`Error buscando el historial de chat: ${chatError.message}`);
            }
            // Si no existe un historial de chat para este usuario, se crea uno.
            // Esto solo ocurrirá UNA VEZ en la vida del usuario: con su primer mensaje.
            if (!chatHistory) {
                console.log(`Creando historial de chat permanente para el usuario ${userId}`);
                const { data: newChat, error: newChatError } = yield supabase
                    .from("chat_history")
                    .insert({ user_id: userId })
                    .select("id")
                    .single();
                if (newChatError) {
                    throw new Error(`Error creando el nuevo historial de chat: ${newChatError.message}`);
                }
                chatHistory = newChat;
            }
            const chatId = chatHistory.id;
            // --- PASO 3: Insertar el mensaje en la tabla 'messages' ---
            // Esta lógica ya era correcta.
            const { data: messageData, error: messageError } = yield supabase
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
            console.log(`Mensaje ${messageData.id} guardado en el chat PERMANENTE ${chatId}`);
            return messageData.id;
        }
        catch (error) {
            console.error("Error en savePetAppMessage:", error);
            return null;
        }
    });
}
// Función para actualizar el SID de Twilio en un mensaje existente
export function updateMessageTwilioSid(messageId, twilioSid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error } = yield supabase
                .from(MESSAGES_TABLE)
                .update({ twilio_sid: twilioSid })
                .eq("id", messageId);
            if (error) {
                throw new Error(`Error updating message with Twilio SID: ${error.message}`);
            }
            console.log(`Message ${messageId} updated with Twilio SID: ${twilioSid}`);
            return true;
        }
        catch (error) {
            console.error("Error in updateMessageTwilioSid:", error);
            return false;
        }
    });
}
// Función para guardar mensajes de plantillas
export function saveTemplateChatHistory(clientNumber, newMessage, isClient, newMediaUrl, user, advisorId // Mantener el parámetro para compatibilidad pero no usarlo
) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const firebaseMediaUrl = newMediaUrl ? newMediaUrl : "";
            // --- PASO 1: Asegurar que el perfil del usuario exista (Find or Create Profile) ---
            let { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id")
                .eq("phone_number", clientNumber)
                .maybeSingle();
            if (profileError) {
                throw new Error(`Error buscando el perfil: ${profileError.message}`);
            }
            if (!profile) {
                console.log(`Perfil no encontrado para ${clientNumber}. Creando uno nuevo...`);
                // Crear perfil directamente sin autenticación de Supabase
                const generatedId = uuidv4();
                const { data: newProfile, error: newProfileError } = yield supabase
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
            let { data: chatHistory, error: chatError } = yield supabase
                .from("chat_history")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();
            if (chatError) {
                throw new Error(`Error buscando el historial de chat: ${chatError.message}`);
            }
            // Si no existe un historial de chat para este usuario, se crea uno.
            if (!chatHistory) {
                console.log(`Creando historial de chat permanente para el usuario ${userId}`);
                const { data: newChat, error: newChatError } = yield supabase
                    .from("chat_history")
                    .insert({ user_id: userId })
                    .select("id")
                    .single();
                if (newChatError) {
                    throw new Error(`Error creando el nuevo historial de chat: ${newChatError.message}`);
                }
                chatHistory = newChat;
            }
            const chatId = chatHistory.id;
            // --- PASO 3: Insertar el mensaje en la tabla 'messages' ---
            const { data: messageData, error: messageError } = yield supabase
                .from("messages")
                .insert({
                chat_id: chatId,
                sender: "notification", // Usar "notification" para plantillas del sistema
                content: newMessage,
                media_url: firebaseMediaUrl || null,
            })
                .select("id")
                .single();
            if (messageError) {
                throw new Error(`Error insertando el mensaje: ${messageError.message}`);
            }
            console.log(`Template message ${messageData.id} guardado en el chat ${chatId}`);
            return messageData.id;
        }
        catch (error) {
            console.error("Error in saveTemplateChatHistory:", error);
            return null;
        }
    });
}
