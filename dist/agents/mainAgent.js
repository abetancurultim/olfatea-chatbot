import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createPetTool, updateProfileTool, createLostPetAlertTool, getOwnerPetsOptimizedTool, updatePetTool, createFoundPetSightingTool, findLostPetsTool, checkSubscriptionStatusTool, 
// Nuevas herramientas de suscripción
validateCompleteProfileTool, updateCompleteProfileTool, initiateSubscriptionTool, processPaymentProofTool, 
// Nuevas herramientas de planes
showAvailablePlansTool, validateCurrentPetLimitTool, getLostPetPhotoTool, // Nueva tool para obtener fotos
 } from "../tools/tools.js";
import { MESSAGES } from "../config/constants.js";
dotenv.config();
const memory = new MemorySaver();
const llm = new ChatOpenAI({
    temperature: 0.4,
    model: "gpt-4.1",
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: 360,
});
const tools = [
    checkSubscriptionStatusTool, // CRÍTICO: Siempre verificar suscripción primero
    // Herramientas de suscripción
    validateCompleteProfileTool, // Validar si perfil está completo para suscripción
    updateCompleteProfileTool, // Actualizar perfil incluyendo neighborhood
    initiateSubscriptionTool, // Mostrar información de pago
    processPaymentProofTool, // Procesar comprobante de pago
    // Nuevas herramientas de planes
    showAvailablePlansTool, // Mostrar planes disponibles
    validateCurrentPetLimitTool, // Verificar límites de mascotas
    // Herramientas de mascotas
    createPetTool,
    updatePetTool,
    updateProfileTool, // Mantener para casos básicos
    getOwnerPetsOptimizedTool,
    createLostPetAlertTool,
    findLostPetsTool, // Nueva herramienta avanzada
    getLostPetPhotoTool, // Buscar foto de mascota perdida
    createFoundPetSightingTool, // Herramienta UNIFICADA para avistamientos y matches
];
const createModifyMessages = (phoneNumber) => (messages) => {
    return [
        new SystemMessage(MESSAGES.SYSTEM_PROMPT),
        new HumanMessage(`Este es el número de teléfono del usuario: ${phoneNumber}`),
        ...messages,
    ];
};
// Función para crear agente con número específico
export const createAgentWithPhone = (phoneNumber) => {
    return createReactAgent({
        llm,
        tools,
        messageModifier: createModifyMessages(phoneNumber),
        checkpointSaver: memory,
    });
};
// Mantener compatibilidad hacia atrás (deprecado)
export const appWithMemory = createReactAgent({
    llm,
    tools,
    messageModifier: (messages) => [
        new SystemMessage(MESSAGES.SYSTEM_PROMPT),
        ...messages,
    ],
    checkpointSaver: memory,
});
