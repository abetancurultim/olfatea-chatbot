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
// Función para Actualizar si el cliente queire o no audios
export function setAvailableForAudio(clientNumber, isAvailableForAudio) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Verificar si el cliente ya tiene un chat
            const { data: existingChat, error: fetchError } = yield supabase
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
                const { error: updateError } = yield supabase
                    .from("chat_history")
                    .update({ audio: isAvailableForAudio })
                    .eq("id", existingChat.id);
                if (updateError) {
                    throw new Error(`Error updating data: ${updateError.message}`);
                    return "error";
                }
                else {
                    console.log("Data updated successfully");
                    return "deacuerdo";
                }
            }
        }
        catch (error) {
            console.error(error);
            return "error";
        }
        return "exito";
    });
}
