var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Guardar hustorial de conversación en Supabase
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);
// Función para consultar si una persona esta disponible para chat automático
export function getAvailableChatOn(clientNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Primero buscar el profile del usuario
            const { data: profile, error: profileError } = yield supabase
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
            const { data: chatHistory, error: chatError } = yield supabase
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
        }
        catch (error) {
            console.error(error);
            // En caso de error, habilitar chat automático
            return false;
        }
    });
}
