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
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobOpportunitiesTool = exports.updateNotificationsTool = exports.validateCityTool = exports.setAvailableForAudioTool = exports.contactTool = exports.saveClientDataTool = exports.retrieverTool = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const functions_1 = require("../utils/functions");
const retrievers_1 = require("../utils/retrievers");
const setAvailableForAudio_1 = require("../utils/setAvailableForAudio");
exports.retrieverTool = (0, tools_1.tool)((_a) => __awaiter(void 0, [_a], void 0, function* ({ query }) {
    const results = yield (0, retrievers_1.searchVectors)(query);
    return results;
}), {
    name: "retriever",
    description: "Eres una herramienta de consulta de información sobre Russell Beford. Tu tarea es buscar y extraer solo la información relevante de la base de datos, respondiendo a las consultas de los clientes. Siempre entrega el resultado bien formateado para que sea facil de leer. Usa esta herramienta para responder preguntas específicas sobre los servicios de Revisoría Fiscal y Servicios Contables que ofrece Russell Bedford Colombia.",
    schema: zod_1.z.object({
        query: zod_1.z.string(),
    }),
});
exports.saveClientDataTool = (0, tools_1.tool)((_a) => __awaiter(void 0, [_a], void 0, function* ({ name, phone, email, city, service, message, schedule, appointment_type }) {
    const saveCliente = yield (0, functions_1.saveClientData)(name, phone, email, city, service, message, schedule, appointment_type);
    return saveCliente;
}), {
    name: 'guardar_datos_del_cliente',
    description: 'Guarda los datos del cliente en la base de datos. Esto lo debes hacer para garantizar un futuro contacto con el cliente por parte de un asesor real. Importante, esta tool solo se debe ejecutar cuando tengas el nombre, celular, correo del cliente, ciudad en donde requiere el servicio, servicio en el que está interesado y la fecha junto con la hora en que desea ser contactado. No la ejecutes si no tienes todos los datos completos.',
    schema: zod_1.z.object({
        name: zod_1.z.string(),
        phone: zod_1.z.string(),
        email: zod_1.z.string(),
        city: zod_1.z.string(),
        service: zod_1.z.string(),
        message: zod_1.z.string(),
        schedule: zod_1.z.string(),
        appointment_type: zod_1.z.string(),
    }),
});
exports.contactTool = (0, tools_1.tool)(() => __awaiter(void 0, void 0, void 0, function* () {
    const contact = (0, functions_1.contactCustomerService)();
    return contact;
}), {
    name: 'contacto_servicio_cliente',
    description: 'Brinda el canal de contacto para otros servicios diferentes a los servicios contables y de revisoría fiscal ofrecidos por Russell Bedford Medellín. Esta tool se debe ejecutar cuando el cliente solicita información sobre otros servicios diferentes a los mencionados anteriormente.',
    schema: zod_1.z.object({}),
});
exports.setAvailableForAudioTool = (0, tools_1.tool)((_a) => __awaiter(void 0, [_a], void 0, function* ({ isAvailableForAudio }) {
    const preferences = (0, setAvailableForAudio_1.setAvailableForAudio)(isAvailableForAudio);
    return preferences;
}), {
    name: "can_the_client_answer_audios",
    description: "si el cliente manifiesta una preferencia por recibir la informacion por audio o por texto o que no puede escuchar audios, si el usuario no peude escuchar audios setea en la base de datos FALSE, si puede escuchar audios setea en la base de datos TRUE. Además, debes enviar nuevamente al cliente el último mensaje que recibió en texto para que lo pueda leer en caso de no poder recibir audios.",
    schema: zod_1.z.object({
        isAvailableForAudio: zod_1.z.boolean(),
    }),
});
exports.validateCityTool = (0, tools_1.tool)((_a) => __awaiter(void 0, [_a], void 0, function* ({ city }) {
    const cityValidation = (0, functions_1.validateCity)(city);
    return cityValidation;
}), {
    name: "validate_city",
    description: "Valida si la ciudad ingresada por el cliente es una ciudad en la que Russell Bedford tiene presencia. Si la ciudad no esta en los departamentos de Antioquia, Córdoba, Chocó, Norte de Santander, Guainía, Boyacá o Arauca, redirige al cliente a la línea de atención correspondiente. Si la ciudad es pertenece a uno de estos departamentos, pregunta si desea agendar una reunión.",
    schema: zod_1.z.object({
        city: zod_1.z.string(),
    }),
});
exports.updateNotificationsTool = (0, tools_1.tool)(() => __awaiter(void 0, void 0, void 0, function* () {
    const notificationsUpdated = yield (0, functions_1.updateNotifications)();
    return notificationsUpdated;
}), {
    name: "update_notifications",
    description: "Actualiza el campo notifications en la base de datos de Supabase en la tabla chat_history a FALSE. Esta tool se debe ejecutar cuando el cliente manifieste de manera clara que no está interesado en los servicios de Russell o que no quiera recibir mas notificaciones. ",
    schema: zod_1.z.object({}),
});
exports.jobOpportunitiesTool = (0, tools_1.tool)(() => __awaiter(void 0, void 0, void 0, function* () {
    const jobOpportunitiesData = (0, functions_1.jobOpportunities)();
    return jobOpportunitiesData;
}), {
    name: "job_opportunities",
    description: "Brinda información sobre las oportunidades laborales en Russell Bedford. Esta tool se debe ejecutar cuando el cliente solicita información sobre las oportunidades laborales en la firma. Retorna los correos de contacto para enviar la hoja de vida.",
    schema: zod_1.z.object({}),
});
