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
exports.setChatHistoryName = setChatHistoryName;
// Guardar hustorial de conversación en Supabase
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const chatRoutes_1 = require("../routes/chatRoutes");
dotenv_1.default.config();
// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// Función para para actualizar el client_name en la base de datos en la tabla chat_history.
function setChatHistoryName(clientName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Verificar si el cliente ya tiene un chat
            const { data: existingChat, error: fetchError } = yield exports.supabase
                .from('chat_history')
                .select('id')
                .eq('client_number', chatRoutes_1.exportedFromNumber)
                .single();
            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: No rows found
                throw new Error(`Error fetching data: ${fetchError.message}`);
            }
            if (existingChat) {
                // Si el cliente ya tiene un chat, actualizar el nombre del cliente
                const { error: updateError } = yield exports.supabase
                    .from('chat_history')
                    .update({ client_name: clientName })
                    .eq('id', existingChat.id);
                if (updateError) {
                    throw new Error(`Error updating data: ${updateError.message}`);
                }
                else {
                    console.log('Data updated successfully');
                }
            }
        }
        catch (error) {
            console.error(error);
        }
    });
}
