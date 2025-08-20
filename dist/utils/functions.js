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
exports.saveClientData = saveClientData;
exports.contactCustomerService = contactCustomerService;
exports.validateCity = validateCity;
exports.updateNotifications = updateNotifications;
exports.jobOpportunities = jobOpportunities;
const supabase_js_1 = require("@supabase/supabase-js");
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import colombia.json file
const colombia_json_1 = __importDefault(require("../data/colombia.json"));
const setChatHistoryName_1 = require("./setChatHistoryName");
const setChatHistoryService_1 = require("./setChatHistoryService");
const chatRoutes_1 = require("../routes/chatRoutes");
dotenv_1.default.config();
// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// Guardar los datos del cliente, nombre, telefono y correo
function saveClientData(name, phone, email, city, service, message, schedule, appointment_type) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { data, error } = yield exports.supabase
                .from('clients')
                .insert([
                { name: name, phone: phone, email: email, city: city, service: service, message: message, schedule: schedule, appointment_type: appointment_type },
            ]);
            console.log('Datos guardados en Supabase:', name, phone, city);
            sendEmailNotification(name, phone, email, city, service, message, schedule, appointment_type);
            yield (0, setChatHistoryName_1.setChatHistoryName)(name);
            yield (0, setChatHistoryService_1.setChatHistoryService)(service);
            if (error) {
                // Mostrar error en consola si no se guardan los datos
                console.error("Error al guardar los datos del cliente:", error);
                throw error;
            }
            return "Datos del cliente guardados correctamente.";
        }
        catch (error) {
            console.log("Error al guardar los datos del cliente:", error);
            throw error;
        }
    });
}
function sendEmailNotification(name, phone, email, city, service, message, schedule, appointment_type) {
    return __awaiter(this, void 0, void 0, function* () {
        const transporter = nodemailer_1.default.createTransport({
            host: "smtp.sendgrid.net",
            port: 587,
            auth: {
                user: "apikey",
                pass: process.env.SENDGRID_API_KEY,
            },
        });
        const mailOptions = {
            from: '"¡Nuevo contacto!" <grow@ultimmarketing.com>',
            to: 'saralopez@rbcol.co',
            cc: ['mercadeo.gct@rbcol.co', 'davidlopez@rbcol.co', 'daniel@ultimmarketing.com', 'alejandro.b@ultimmarketing.com'],
            subject: 'Russell Bedford - Nuevo cliente registrado de WhatsApp',
            text: `¡Nuevo cliente registrado de WhatsApp! \n\nNombre: ${name} \nCelular: ${phone} \nCorreo: ${email} \nCiudad: ${city} \nServicio: ${service} \nMensaje: ${message} \nAgenda: ${schedule} \nTipo de cita: ${appointment_type}`,
        };
        try {
            const info = yield transporter.sendMail(mailOptions);
            console.log('Email sent:', info.response);
            return "Email enviado correctamente.";
        }
        catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    });
}
;
// Prueba de Mail
// sendEmailNotification('Alejandro', '1234567890', 'alejandro.b@ultimmarketing.com', 'Fiscal', 'Mensaje de prueba', 'Mañana a las 10:00 am');
// Función para brindar canal de contacto de otros servicios diferentes a servicios contables y de revisoría fiscal ofrecidos por Russell Bedford
function contactCustomerService() {
    const customerServiceData = {
        whatsapp: "https://wa.me/573186925681",
        description: "Linea de atención especializada para otros servicios diferentes a contabilidad y revisoría fiscal.",
    };
    return JSON.stringify(customerServiceData);
}
// Función para eliminar tildes y diéresis
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// Lista de departamentos permitidos
const allowedDepartments = [
    "Antioquia",
    "Córdoba",
    "Chocó",
    "Norte de Santander",
    "Guainía",
    "Boyacá",
    "Arauca"
];
// Función para validar si el municipio ingresado pertenece a Antioquia, Córdoba, Chocó, Norte de Santander, Guainía, Boyacá o Arauca. Leerlo del archivo colombia.json
function validateCity(city) {
    const normalizedCity = removeAccents(city.toLowerCase());
    const filteredDepartments = colombia_json_1.default.filter((dept) => allowedDepartments.includes(dept.departamento));
    const cityExists = filteredDepartments.some((dept) => dept.ciudades.some((c) => removeAccents(c.toLowerCase()) === normalizedCity));
    if (cityExists) {
        return "Perfecto, tu ciudad está dentro de nuestra cobertura.";
    }
    return "Lo siento, actualmente no tenemos cobertura en tu ciudad. Puedes comunicarte en el siguiente enlace: https://wa.me/573186925681";
}
// Función para cambiar el campo notifications en la base de datos de Supabase en la tabla chat_history a FALSE.
function updateNotifications() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { data: chatHistory, error } = yield exports.supabase
                .from('chat_history')
                .select('id')
                .eq('client_number', chatRoutes_1.exportedFromNumber)
                .single();
            if (error) {
                throw new Error(`Error fetching data: ${error.message}`);
            }
            if (chatHistory) {
                yield exports.supabase
                    .from("chat_history")
                    .update({ notifications: false })
                    .eq("id", chatHistory.id);
            }
            return "Notificaciones actualizadas correctamente.";
        }
        catch (error) {
            console.error(error);
            return "Error al actualizar las notificaciones.";
        }
    });
}
// Función si quien escribe pregunta por ofertas laborales
function jobOpportunities() {
    const jobOpportunitiesData = `
    ¡Gracias por tu interés en formar parte de nuestro equipo!
    Si deseas aplicar a una de nuestras vacantes, envíanos tu hoja de vida al correo correspondiente según tu ciudad:
    
     Medellín: talentohumano.gct@rbcol.co
    
     Bogotá: gestionhumana@rbcol.co
    
     Cali: gestionhumana.cali@rbcol.co
    
     Cartagena: talentohumanorb@rbcol.co
    
     Barranquilla: talentohumanorb@rbcol.co
    
     Instrucciones para el envío:
    
    Indica tu profesión en el asunto del correo.
    En el cuerpo del mensaje, menciona tu aspiración salarial.
    Si tu perfil se ajusta a alguna de nuestras vacantes, el equipo de Talento Humano de la ciudad correspondiente se pondrá en contacto contigo.
    ¡Esperamos recibir tu aplicación pronto!
  `;
    return JSON.stringify(jobOpportunitiesData);
}
