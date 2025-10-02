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
// Función para consultar si una persona esta disponible para mandarle audios
export function getAvailableForAudio(clientNumber) {
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
            // Si no existe el perfil, habilitar audio por defecto
            if (!profile) {
                return true;
            }
            // Buscar la configuración de audio para este usuario
            const { data: chatHistory, error: chatError } = yield supabase
                .from("chat_history")
                .select("audio")
                .eq("user_id", profile.id)
                .single();
            if (chatError && chatError.code !== "PGRST116") {
                throw new Error(`Error fetching audio config: ${chatError.message}`);
            }
            // Si existe configuración, devolver el valor de audio
            if (chatHistory) {
                return chatHistory.audio !== false; // Por defecto true si es null
            }
            // Si no existe configuración, habilitar audio por defecto
            return true;
        }
        catch (error) {
            console.error(error);
            // En caso de error, habilitar audio
            return true;
        }
    });
}
