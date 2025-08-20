"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.saveChatHistory = saveChatHistory;
// Guardar hustorial de conversación en Supabase
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// interface ChatHistory {
//     id: number;
//     client_number: string;
//     messages: ChatMessage[];
// }
// Función para guardar o actualizar el historial del chat
function saveChatHistory(clientNumber, newMessage, isClient) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Verificar si el cliente ya tiene un chat
            const { data: existingChat, error: fetchError } = yield exports.supabase
                .from('chat_history')
                .select('id, messages')
                .eq('client_number', clientNumber)
                .single();
            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: No rows found
                throw new Error(`Error fetching data: ${fetchError.message}`);
            }
            const newEntry = {
                user: isClient ? 'client_message' : 'agent_message',
                message: newMessage,
                date: new Date().toISOString()
            };
            if (existingChat) {
                // Si el cliente ya tiene un chat, agregar el nuevo mensaje al historial existente
                const updatedMessages = [...existingChat.messages, newEntry];
                const { error: updateError } = yield exports.supabase
                    .from('chat_history')
                    .update({ messages: updatedMessages })
                    .eq('id', existingChat.id);
                if (updateError) {
                    throw new Error(`Error updating data: ${updateError.message}`);
                }
                else {
                    console.log('Data updated successfully');
                }
            }
            else {
                // Si el cliente no tiene un chat, crear un nuevo registro con el historial inicial
                const updatedMessages = [newEntry];
                const { error: insertError } = yield exports.supabase
                    .from('chat_history')
                    .insert([
                    {
                        client_number: clientNumber,
                        messages: updatedMessages
                    }
                ]);
                if (insertError) {
                    throw new Error(`Error inserting data: ${insertError.message}`);
                }
                else {
                    console.log('Data inserted successfully');
                }
            }
        }
        catch (error) {
            console.error(error);
        }
    });
}
