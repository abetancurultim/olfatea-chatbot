var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import axios from "axios";
import twilio from "twilio";
import { MARKETING_CONFIG } from "../config/constants.js";
// Import colombia.json file
dotenv.config();
// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);
/**
 * Función auxiliar para validar si una cadena es un UUID válido
 * @param uuid La cadena a validar
 * @returns true si es un UUID válido, false en caso contrario
 */
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
/**
 * Extrae el patch URL de una URL completa de Firebase Storage
 * @param fullUrl URL completa de Firebase Storage
 * @returns Patch URL (parte después de /o/)
 */
function extractPatchUrlFromFirebase(fullUrl) {
    try {
        const url = new URL(fullUrl);
        const pathParts = url.pathname.split('/o/');
        if (pathParts.length < 2) {
            throw new Error('URL de Firebase inválida - no contiene /o/');
        }
        // Incluir 'o/' al inicio + query params (token, alt=media) - Formato requerido por Twilio
        const patchUrl = 'o/' + pathParts[1] + url.search;
        return patchUrl;
    }
    catch (error) {
        console.error('Error extrayendo patch URL:', error);
        throw new Error('La URL de la foto no tiene el formato esperado de Firebase Storage');
    }
}
/*
🚀 OPTIMIZACIONES IMPLEMENTADAS (Sept 2025):

📊 TABLA ACTIVE_LOST_PETS_DETAILS:
Esta tabla espejo contiene toda la información consolidada de mascotas con alertas activas,
eliminando la necesidad de hacer JOINs complejos para consultas de mascotas perdidas.

🔧 FUNCIONES OPTIMIZADAS:
- validatePetOwnershipOptimized(): Busca primero en active_lost_pets_details, fallback a pets
- getOwnerPetsOptimized(): Combina datos de pets con información de alertas activas
- getOwnerActiveLostPets(): Consulta directa a active_lost_pets_details (más rápida)
- createLostPetAlert(): Usa active_lost_pets_details para verificar alertas existentes

📍 INFORMACIÓN DE UBICACIÓN MEJORADA (Sept 2025):
- searchLostPetsImproved(): Incluye campo lostLocationDetails consolidado
- searchLostPets(): Incluye campo lostLocationDetails consolidado
- lostLocationDetails: Combina last_seen_description, alert_notes, y owner_city
- Ayuda a quienes reportan avistamientos a verificar proximidad de ubicación

⚡ BENEFICIOS:
- Menos consultas a BD para verificaciones de alertas
- Mejor rendimiento en búsquedas de mascotas perdidas
- Información más rica (combina datos de ambas tablas)
- Información de ubicación clara y consolidada para verificación
- Mantiene compatibilidad con funciones existentes

📋 ESTRATEGIA DE USO:
- Tabla 'pets': Registro/gestión general de mascotas
- Tabla 'active_lost_pets_details': Consultas y verificaciones de alertas activas
- Funciones optimizadas: Balance entre rendimiento e información completa
*/
// Función para tool de prueba
export const testFunction = () => __awaiter(void 0, void 0, void 0, function* () {
    return "Hola, este es un mensaje de prueba";
});
/**
 * Función para obtener los detalles de un plan específico por ID o nombre
 * @param planIdentifier El ID o nombre del plan a consultar
 * @returns Objeto con los datos del plan o null si no existe
 */
export function getPlanDetails(planIdentifier) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🔍 Buscando plan con identificador: "${planIdentifier}"`);
            // Primero intentar buscar por ID (si es un UUID válido)
            if (isValidUUID(planIdentifier)) {
                console.log(`📋 Buscando por UUID: ${planIdentifier}`);
                const { data: plan, error: planError } = yield supabase
                    .from("plans")
                    .select("id, name, price, pet_limit, duration_months, active")
                    .eq("id", planIdentifier)
                    .eq("active", true)
                    .maybeSingle();
                if (planError) {
                    console.error("Error obteniendo detalles del plan por ID:", planError);
                }
                else if (plan) {
                    console.log(`✅ Plan encontrado por ID: ${plan.name}`);
                    return plan;
                }
            }
            // Si no es UUID o no se encontró por ID, buscar por nombre (case-insensitive)
            console.log(`📋 Buscando por nombre: "${planIdentifier}"`);
            const { data: plan, error: planError } = yield supabase
                .from("plans")
                .select("id, name, price, pet_limit, duration_months, active")
                .ilike("name", `%${planIdentifier}%`)
                .eq("active", true)
                .maybeSingle();
            if (planError) {
                console.error("Error obteniendo detalles del plan por nombre:", planError);
                return null;
            }
            if (plan) {
                console.log(`✅ Plan encontrado por nombre: ${plan.name}`);
                return plan;
            }
            console.log(`❌ No se encontró ningún plan con identificador: "${planIdentifier}"`);
            return null;
        }
        catch (error) {
            console.error("Error en getPlanDetails:", error);
            return null;
        }
    });
}
/**
 * Función para buscar un plan por nombre específico (busca coincidencias exactas primero, luego parciales)
 * @param planName El nombre del plan a buscar
 * @returns Objeto con los datos del plan o null si no existe
 */
export function findPlanByName(planName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🔍 Buscando plan con nombre específico: "${planName}"`);
            // Normalizar el nombre de entrada
            const normalizedPlanName = planName.toLowerCase().trim();
            // Mapeo de nombres comunes a nombres exactos en la BD
            const planNameMapping = {
                'huellita': 'Plan Huellita',
                'plan huellita': 'Plan Huellita',
                'huellita 1 mascota': 'Plan Huellita',
                '1': 'Plan Huellita',
                'doble': 'Plan Doble Huella',
                'plan doble': 'Plan Doble Huella',
                'doble huella': 'Plan Doble Huella',
                'plan doble huella': 'Plan Doble Huella',
                '2': 'Plan Doble Huella',
                'triple': 'Plan Triple Huella',
                'plan triple': 'Plan Triple Huella',
                'triple huella': 'Plan Triple Huella',
                'plan triple huella': 'Plan Triple Huella',
                '3': 'Plan Triple Huella',
                'gran manada': 'Plan Gran Manada Básico',
                'plan gran manada': 'Plan Gran Manada Básico',
                'gran manada basico': 'Plan Gran Manada Básico',
                'plan gran manada basico': 'Plan Gran Manada Básico',
                '4': 'Plan Gran Manada Básico',
                'gran manada premium': 'Plan Gran Manada Premium',
                'plan gran manada premium': 'Plan Gran Manada Premium',
                'premium': 'Plan Gran Manada Premium',
                '5': 'Plan Gran Manada Premium',
                // Plan Inmediato (Emergencia)
                'inmediato': 'Plan Inmediato',
                'plan inmediato': 'Plan Inmediato',
                'emergencia': 'Plan Inmediato',
                'plan emergencia': 'Plan Inmediato',
                'plan de emergencia': 'Plan Inmediato'
            };
            // Verificar si hay un mapeo directo
            const mappedName = planNameMapping[normalizedPlanName];
            if (mappedName) {
                console.log(`📋 Usando mapeo: "${planName}" -> "${mappedName}"`);
                const { data: plan, error: planError } = yield supabase
                    .from("plans")
                    .select("id, name, price, pet_limit, duration_months, active")
                    .ilike("name", mappedName)
                    .eq("active", true)
                    .maybeSingle();
                if (planError) {
                    console.error("Error obteniendo plan por nombre mapeado:", planError);
                }
                else if (plan) {
                    console.log(`✅ Plan encontrado por mapeo: ${plan.name}`);
                    return plan;
                }
            }
            // Si no hay mapeo, buscar por coincidencia parcial
            console.log(`📋 Buscando por coincidencia parcial: "${planName}"`);
            const { data: plan, error: planError } = yield supabase
                .from("plans")
                .select("id, name, price, pet_limit, duration_months, active")
                .ilike("name", `%${normalizedPlanName}%`)
                .eq("active", true)
                .maybeSingle();
            if (planError) {
                console.error("Error obteniendo plan por coincidencia parcial:", planError);
                return null;
            }
            if (plan) {
                console.log(`✅ Plan encontrado por coincidencia parcial: ${plan.name}`);
                return plan;
            }
            console.log(`❌ No se encontró ningún plan con nombre: "${planName}"`);
            return null;
        }
        catch (error) {
            console.error("Error en findPlanByName:", error);
            return null;
        }
    });
}
/**
 * Función para calcular precio de marketing con descuentos
 * @param planName Nombre del plan
 * @param realPrice Precio real del plan
 * @returns Objeto con información de marketing del precio
 */
export function getMarketingPrice(planName, realPrice) {
    if (MARKETING_CONFIG.DISCOUNTED_PLANS.includes(planName)) {
        const marketingPrice = MARKETING_CONFIG.MARKETING_PRICES[planName];
        const discount = marketingPrice - realPrice;
        return {
            hasDiscount: true,
            marketingPrice,
            realPrice,
            discount,
            discountPercentage: MARKETING_CONFIG.DISCOUNT_PERCENTAGE
        };
    }
    return {
        hasDiscount: false,
        marketingPrice: realPrice,
        realPrice,
        discount: 0,
        discountPercentage: 0
    };
}
/**
 * Función para obtener todos los planes disponibles con información de marketing
 * @returns Array con todos los planes activos ordenados por precio, incluyendo info de descuentos
 */
export function getAvailablePlans() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { data: plans, error: plansError } = yield supabase
                .from("plans")
                .select("id, name, price, pet_limit, duration_months, active")
                .eq("active", true)
                .order("price", { ascending: true });
            if (plansError) {
                console.error("Error obteniendo planes disponibles:", plansError);
                return [];
            }
            // Agregar información de marketing a cada plan
            const plansWithMarketing = (plans || []).map(plan => {
                const marketingInfo = getMarketingPrice(plan.name, plan.price);
                return Object.assign(Object.assign({}, plan), { marketingPrice: marketingInfo.marketingPrice, hasDiscount: marketingInfo.hasDiscount, discount: marketingInfo.discount, discountPercentage: marketingInfo.discountPercentage });
            });
            return plansWithMarketing;
        }
        catch (error) {
            console.error("Error en getAvailablePlans:", error);
            return [];
        }
    });
}
/**
 * Función para validar si un usuario puede registrar una nueva mascota según sus planes activos
 * ACTUALIZADA: Suma los límites de TODAS las suscripciones activas del usuario
 * @param phoneNumber El número de teléfono del usuario
 * @returns Objeto con resultado de la validación
 */
export function validatePetLimit(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🔢 Validando límite de mascotas para ${phoneNumber}...`);
            // Obtener información de suscripciones del usuario (ya incluye conteo de mascotas)
            const subscriptionStatus = yield hasActiveSubscription(phoneNumber);
            if (!subscriptionStatus.active || !subscriptionStatus.profile) {
                return {
                    canRegister: false,
                    currentPetCount: 0,
                    planLimit: 0,
                    totalPetLimit: 0,
                    planName: "Sin suscripción",
                    activeSubscriptions: [],
                    reason: "Debes suscribirte para poder registrar mascotas"
                };
            }
            // Si no hay suscripciones activas
            if (subscriptionStatus.subscriptions.length === 0) {
                return {
                    canRegister: false,
                    currentPetCount: subscriptionStatus.currentPetCount,
                    planLimit: 0,
                    totalPetLimit: 0,
                    planName: "Sin plan activo",
                    activeSubscriptions: [],
                    reason: "No tienes ninguna suscripción activa"
                };
            }
            // Usar los datos ya calculados por hasActiveSubscription
            const currentPetCount = subscriptionStatus.currentPetCount;
            const totalPetLimit = subscriptionStatus.totalPetLimit;
            const activeSubscriptions = subscriptionStatus.subscriptions;
            // Verificar si puede registrar más mascotas
            const canRegister = currentPetCount < totalPetLimit;
            // Manejar caso especial de planes ilimitados (999 = ilimitado)
            const hasUnlimitedPlan = activeSubscriptions.some(sub => { var _a; return (((_a = sub.plan) === null || _a === void 0 ? void 0 : _a.pet_limit) || 0) >= 999; });
            // Crear descripción de planes activos
            const plansDescription = activeSubscriptions.map(sub => { var _a, _b, _c; return `${((_a = sub.plan) === null || _a === void 0 ? void 0 : _a.name) || 'Plan desconocido'} (${((_b = sub.plan) === null || _b === void 0 ? void 0 : _b.pet_limit) || 0} ${(((_c = sub.plan) === null || _c === void 0 ? void 0 : _c.pet_limit) || 0) >= 999 ? 'ilimitadas' : 'mascotas'})`; }).join(', ');
            let reason;
            if (hasUnlimitedPlan) {
                reason = `Tienes plan(es) con mascotas ilimitadas: ${plansDescription}. Mascotas registradas: ${currentPetCount}`;
            }
            else if (canRegister) {
                reason = `Puedes registrar más mascotas. Tienes ${currentPetCount} de ${totalPetLimit} permitidas en tus planes: ${plansDescription}`;
            }
            else {
                reason = `Has alcanzado el límite de ${totalPetLimit} mascotas de tus planes activos: ${plansDescription}`;
            }
            console.log(`📊 Validación: ${currentPetCount}/${totalPetLimit} mascotas. Puede registrar: ${hasUnlimitedPlan || canRegister}`);
            return {
                canRegister: hasUnlimitedPlan ? true : canRegister,
                currentPetCount,
                planLimit: totalPetLimit, // Para compatibilidad con código existente
                totalPetLimit,
                planName: plansDescription,
                activeSubscriptions,
                reason
            };
        }
        catch (error) {
            console.error("Error en validatePetLimit:", error);
            return {
                canRegister: false,
                currentPetCount: 0,
                planLimit: 0,
                totalPetLimit: 0,
                planName: "Error",
                activeSubscriptions: [],
                reason: "Error interno al validar límites"
            };
        }
    });
}
/**
 * Función para validar si un usuario tiene suscripciones activas
 * ACTUALIZADA: Ahora soporta múltiples suscripciones simultáneas desde user_subscriptions
 * Los límites de mascotas se SUMAN de todas las suscripciones activas
 * @param phoneNumber El número de teléfono del usuario
 * @returns Objeto con estado de suscripciones, límites totales y detalles
 */
export function hasActiveSubscription(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Consultar perfil del usuario
            const { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id, is_subscriber, subscription_activated_at, subscription_expires_at, plan_id")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (profileError) {
                return {
                    active: false,
                    status: 'none',
                    reason: `Error consultando perfil: ${profileError.message}`,
                    subscriptions: [],
                    totalPetLimit: 0,
                    currentPetCount: 0,
                    profile: null
                };
            }
            // Si no existe perfil
            if (!profile) {
                return {
                    active: false,
                    status: 'none',
                    reason: 'Perfil no encontrado - necesita registrarse y suscribirse',
                    subscriptions: [],
                    totalPetLimit: 0,
                    currentPetCount: 0,
                    profile: null
                };
            }
            // --- NUEVO ENFOQUE: Consultar user_subscriptions ---
            console.log(`🔍 Consultando suscripciones desde user_subscriptions...`);
            const now = new Date();
            const { data: userSubscriptions, error: subscriptionsError } = yield supabase
                .from("user_subscriptions")
                .select(`
        id,
        user_id,
        plan_id,
        subscription_status,
        activated_at,
        expires_at,
        created_at,
        plans:plan_id (
          name,
          price,
          pet_limit,
          duration_months
        )
      `)
                .eq("user_id", profile.id)
                .eq("subscription_status", "active")
                .gte("expires_at", now.toISOString())
                .order("expires_at", { ascending: false });
            if (subscriptionsError) {
                console.error("Error consultando suscripciones:", subscriptionsError);
                return {
                    active: false,
                    status: 'none',
                    reason: `Error técnico consultando suscripciones: ${subscriptionsError.message}`,
                    subscriptions: [],
                    totalPetLimit: 0,
                    currentPetCount: 0,
                    profile: profile
                };
            }
            // Si no hay suscripciones activas en user_subscriptions
            if (!userSubscriptions || userSubscriptions.length === 0) {
                console.log(`❌ No se encontraron suscripciones activas para ${phoneNumber}`);
                return {
                    active: false,
                    status: 'none',
                    reason: 'No tiene suscripción activa - debe adquirir un plan',
                    subscriptions: [],
                    totalPetLimit: 0,
                    currentPetCount: 0,
                    profile: profile
                };
            }
            // Transformar suscripciones con datos del plan
            const activeSubscriptions = userSubscriptions.map((sub) => ({
                id: sub.id,
                user_id: sub.user_id,
                plan_id: sub.plan_id,
                subscription_status: sub.subscription_status,
                activated_at: sub.activated_at,
                expires_at: sub.expires_at,
                created_at: sub.created_at,
                plan: Array.isArray(sub.plans) ? sub.plans[0] : sub.plans
            }));
            // SUMAR los límites de mascotas de TODAS las suscripciones activas
            const totalPetLimit = activeSubscriptions.reduce((sum, sub) => {
                var _a;
                return sum + (((_a = sub.plan) === null || _a === void 0 ? void 0 : _a.pet_limit) || 0);
            }, 0);
            // Contar mascotas actuales del usuario
            const { data: pets, error: petsError } = yield supabase
                .from("pets")
                .select("id")
                .eq("owner_id", profile.id);
            const currentPetCount = (pets === null || pets === void 0 ? void 0 : pets.length) || 0;
            console.log(`✅ Usuario tiene ${activeSubscriptions.length} suscripción(es) activa(s)`);
            console.log(`📊 Límite total de mascotas: ${totalPetLimit} | Mascotas registradas: ${currentPetCount}`);
            // Suscripción activa
            return {
                active: true,
                status: 'active',
                reason: `${activeSubscriptions.length} suscripción(es) activa(s). Límite total: ${totalPetLimit} mascotas`,
                subscriptions: activeSubscriptions,
                totalPetLimit,
                currentPetCount,
                profile: profile
            };
        }
        catch (error) {
            console.error("Error en hasActiveSubscription:", error);
            return {
                active: false,
                status: 'none',
                reason: `Error técnico validando suscripción: ${error}`,
                subscriptions: [],
                totalPetLimit: 0,
                currentPetCount: 0,
                profile: null
            };
        }
    });
}
/**
 * Función para crear una mascota asociada a un usuario por número de teléfono
 * REQUIERE SUSCRIPCIÓN ACTIVA para poder registrar mascotas
 * @param clientNumber El número de teléfono del propietario
 * @param petData Datos de la mascota (mínimo: nombre)
 * @returns Objeto con resultado de la operación
 */
export function createPet(clientNumber, petData) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        try {
            // 🆕 VALIDACIÓN ESTRICTA DE CAMPOS OBLIGATORIOS
            const missingFields = [];
            if (!((_a = petData.name) === null || _a === void 0 ? void 0 : _a.trim()))
                missingFields.push("nombre");
            if (!((_b = petData.species) === null || _b === void 0 ? void 0 : _b.trim()))
                missingFields.push("especie (Perro, Gato, etc.)");
            if (!((_c = petData.breed) === null || _c === void 0 ? void 0 : _c.trim()))
                missingFields.push("raza específica");
            if (!((_d = petData.color) === null || _d === void 0 ? void 0 : _d.trim()))
                missingFields.push("color predominante");
            if (!((_e = petData.gender) === null || _e === void 0 ? void 0 : _e.trim()))
                missingFields.push("género (Macho/Hembra)");
            if (!((_f = petData.photo_url) === null || _f === void 0 ? void 0 : _f.trim()))
                missingFields.push("foto clara de la mascota");
            if (!((_g = petData.size) === null || _g === void 0 ? void 0 : _g.trim()))
                missingFields.push("tamaño (Miniatura, Pequeño, Mediano, Grande, Gigante)");
            if (!((_h = petData.coat_type) === null || _h === void 0 ? void 0 : _h.trim()))
                missingFields.push("tipo de pelaje (Corto, Medio, Largo, Sin Pelo)");
            if (missingFields.length > 0) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `⚠️ DATOS OBLIGATORIOS FALTANTES: ${missingFields.join(", ")}

🔍 Estos datos son CRÍTICOS para poder encontrar tu mascota si se pierde. 

📸 Especialmente la FOTO y las MARCAS DISTINTIVAS son fundamentales para que otros usuarios puedan identificar a tu mascota.

Por favor, proporciona TODOS estos datos antes de continuar.`
                    }
                };
            }
            // 🆕 Los campos ya fueron validados como presentes arriba
            // La IA normalizará los valores según el prompt (ej: "pequeñito" → "Pequeño")
            // 🆕 RECOMENDACIÓN FUERTE de distinguishing_marks
            if (!petData.distinguishing_marks || petData.distinguishing_marks.trim() === "") {
                console.log(`⚠️ ADVERTENCIA: Mascota sin marcas distintivas especificadas`);
                // No bloquear, pero loguear para advertir al usuario después
            }
            // --- VALIDACIÓN DE SUSCRIPCIÓN ---
            console.log(`🔐 Validando suscripción para ${clientNumber}...`);
            const subscriptionCheck = yield hasActiveSubscription(clientNumber);
            if (!subscriptionCheck.active) {
                const errorCode = subscriptionCheck.status === 'expired'
                    ? 'SUBSCRIPTION_EXPIRED'
                    : subscriptionCheck.status === 'none'
                        ? 'SUBSCRIPTION_REQUIRED'
                        : 'SUBSCRIPTION_INVALID';
                return {
                    success: false,
                    error: {
                        code: errorCode,
                        message: subscriptionCheck.reason || 'Suscripción requerida para registrar mascotas',
                        status: subscriptionCheck.status
                    }
                };
            }
            console.log(`✅ Suscripción activa verificada para ${clientNumber}`);
            // --- VALIDACIÓN DE LÍMITE DE MASCOTAS ---
            console.log(`🔢 Validando límite de mascotas para ${clientNumber}...`);
            const petLimitCheck = yield validatePetLimit(clientNumber);
            if (!petLimitCheck.canRegister) {
                return {
                    success: false,
                    error: {
                        code: 'PET_LIMIT_EXCEEDED',
                        message: petLimitCheck.reason || 'Ha alcanzado el límite de mascotas de su plan',
                        planInfo: {
                            currentCount: petLimitCheck.currentPetCount,
                            limit: petLimitCheck.planLimit,
                            planName: petLimitCheck.planName
                        }
                    }
                };
            }
            console.log(`✅ Límite de mascotas validado: ${petLimitCheck.currentPetCount}/${petLimitCheck.planLimit} (${petLimitCheck.planName})`);
            // --- BUSCAR O CREAR PERFIL ---
            let profileId;
            if (subscriptionCheck.profile) {
                // Ya tenemos el perfil de la validación de suscripción
                profileId = subscriptionCheck.profile.id;
            }
            else {
                // Caso edge: perfil no existía pero se creó en otro lugar
                let { data: profile, error: profileError } = yield supabase
                    .from("profiles")
                    .select("id")
                    .eq("phone_number", clientNumber)
                    .maybeSingle();
                if (profileError) {
                    return {
                        success: false,
                        error: {
                            code: 'DATABASE_ERROR',
                            message: `Error buscando el perfil: ${profileError.message}`
                        }
                    };
                }
                if (!profile) {
                    return {
                        success: false,
                        error: {
                            code: 'SUBSCRIPTION_REQUIRED',
                            message: 'Perfil no encontrado - debe registrarse y suscribirse primero'
                        }
                    };
                }
                profileId = profile.id;
            }
            // --- CREAR LA MASCOTA ---
            const { data: newPet, error: petError } = yield supabase
                .from("pets")
                .insert({
                owner_id: profileId,
                name: petData.name.trim(),
                species: petData.species.trim(),
                breed: petData.breed.trim(),
                color: petData.color.trim(),
                birth_date: petData.birth_date || null,
                gender: petData.gender.trim(),
                photo_url: petData.photo_url.trim(),
                distinguishing_marks: ((_j = petData.distinguishing_marks) === null || _j === void 0 ? void 0 : _j.trim()) || null,
                size: petData.size.trim(),
                coat_type: petData.coat_type.trim(),
                is_currently_lost: false,
            })
                .select("id")
                .single();
            if (petError) {
                console.error("❌ ERROR COMPLETO AL CREAR MASCOTA:", JSON.stringify(petError, null, 2));
                console.error("❌ Detalles del error:", petError.message);
                console.error("❌ Código del error:", petError.code);
                console.error("❌ Detalles adicionales:", petError.details);
                return {
                    success: false,
                    error: {
                        code: 'DATABASE_ERROR',
                        message: `Error creando la mascota: ${petError.message} | Código: ${petError.code} | Detalles: ${petError.details}`
                    }
                };
            }
            console.log(`🐾 Mascota creada exitosamente: ${newPet.id} para propietario: ${profileId}`);
            return {
                success: true,
                petId: newPet.id
            };
        }
        catch (error) {
            console.error("Error en createPet:", error);
            return {
                success: false,
                error: {
                    code: 'DATABASE_ERROR',
                    message: `Error inesperado: ${error}`
                }
            };
        }
    });
}
/**
 * Función para actualizar los datos del perfil del cliente
 * @param phoneNumber El número de teléfono del cliente (identificador único)
 * @param fullName Nombre completo del cliente
 * @param email Email del cliente
 * @param city Ciudad del cliente
 * @param country País del cliente
 * @returns Mensaje de confirmación o null si hubo un error
 */
export function updateClientProfile(phoneNumber, fullName, email, city, country) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validar que al menos un campo adicional sea proporcionado
            if (!fullName && !email && !city && !country) {
                throw new Error("Debe proporcionar al menos un campo para actualizar");
            }
            // Buscar el perfil existente por número de teléfono
            const { data: existingProfile, error: searchError } = yield supabase
                .from("profiles")
                .select("id")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (searchError) {
                throw new Error(`Error buscando el perfil: ${searchError.message}`);
            }
            if (!existingProfile) {
                throw new Error(`No se encontró un perfil con el número de teléfono: ${phoneNumber}`);
            }
            // Preparar los datos para actualizar (solo campos no vacíos)
            const updateData = {};
            if (fullName && fullName.trim() !== "")
                updateData.full_name = fullName.trim();
            if (email && email.trim() !== "")
                updateData.email = email.trim();
            if (city && city.trim() !== "")
                updateData.city = city.trim();
            if (country && country.trim() !== "")
                updateData.country = country.trim();
            // Actualizar el perfil
            const { error: updateError } = yield supabase
                .from("profiles")
                .update(updateData)
                .eq("id", existingProfile.id);
            if (updateError) {
                throw new Error(`Error actualizando el perfil: ${updateError.message}`);
            }
            console.log(`Perfil actualizado para el número: ${phoneNumber}`);
            // Crear mensaje de confirmación con los campos actualizados
            const updatedFields = [];
            if (updateData.full_name)
                updatedFields.push(`Nombre: ${updateData.full_name}`);
            if (updateData.email)
                updatedFields.push(`Email: ${updateData.email}`);
            if (updateData.city)
                updatedFields.push(`Ciudad: ${updateData.city}`);
            if (updateData.country)
                updatedFields.push(`País: ${updateData.country}`);
            return `Perfil actualizado exitosamente. ${updatedFields.join(", ")}`;
        }
        catch (error) {
            console.error("Error en updateClientProfile:", error);
            return null;
        }
    });
}
/**
 * Función para obtener las mascotas de un propietario por número de teléfono
 * @param phoneNumber El número de teléfono del propietario
 * @returns Array de mascotas del propietario o null si hubo un error
 */
export function getOwnerPets(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Buscar el perfil del propietario
            const { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (profileError) {
                throw new Error(`Error buscando el perfil: ${profileError.message}`);
            }
            if (!profile) {
                throw new Error(`No se encontró un perfil con el número de teléfono: ${phoneNumber}`);
            }
            // Obtener las mascotas del propietario
            const { data: pets, error: petsError } = yield supabase
                .from("pets")
                .select("id, name, species, breed, gender, photo_url, is_currently_lost")
                .eq("owner_id", profile.id);
            if (petsError) {
                throw new Error(`Error obteniendo las mascotas: ${petsError.message}`);
            }
            return pets || [];
        }
        catch (error) {
            console.error("Error en getOwnerPets:", error);
            return null;
        }
    });
}
/**
 * Función optimizada para obtener las mascotas de un propietario
 * Combina información de pets con alertas activas de active_lost_pets_details
 * @param phoneNumber El número de teléfono del propietario
 * @returns Array de mascotas del propietario con información de alertas o null si hubo un error
 */
export function getOwnerPetsOptimized(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Obtener mascotas básicas del propietario
            const basicPets = yield getOwnerPets(phoneNumber);
            if (!basicPets) {
                return null;
            }
            if (basicPets.length === 0) {
                return [];
            }
            // Obtener información de alertas activas para este propietario
            const { data: activePets, error: activeError } = yield supabase
                .from("active_lost_pets_details")
                .select("pet_id, pet_name, alert_id, alert_status, last_seen_at")
                .eq("owner_phone", phoneNumber)
                .eq("alert_status", "active");
            if (activeError) {
                console.error("Error obteniendo alertas activas:", activeError);
                // En caso de error, devolver solo las mascotas básicas
                return basicPets;
            }
            // Combinar información: agregar datos de alertas a las mascotas básicas
            const enrichedPets = basicPets.map(pet => {
                const activeAlert = activePets === null || activePets === void 0 ? void 0 : activePets.find(active => active.pet_id === pet.id);
                return Object.assign(Object.assign({}, pet), { has_active_alert: !!activeAlert, alert_id: (activeAlert === null || activeAlert === void 0 ? void 0 : activeAlert.alert_id) || null, last_seen_at: (activeAlert === null || activeAlert === void 0 ? void 0 : activeAlert.last_seen_at) || null, is_currently_lost: !!activeAlert // Actualizar basado en alerta activa real
                 });
            });
            console.log(`📊 Mascotas obtenidas: ${enrichedPets.length}, con alertas activas: ${(activePets === null || activePets === void 0 ? void 0 : activePets.length) || 0}`);
            return enrichedPets;
        }
        catch (error) {
            console.error("Error en getOwnerPetsOptimized:", error);
            return null;
        }
    });
}
/**
 * Función para obtener solo las mascotas con alertas activas de un propietario
 * Usa directamente active_lost_pets_details para máximo rendimiento
 * @param phoneNumber El número de teléfono del propietario
 * @returns Array de mascotas con alertas activas o null si hubo un error
 */
export function getOwnerActiveLostPets(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🔍 Obteniendo mascotas con alertas activas para: ${phoneNumber}`);
            const { data: activePets, error } = yield supabase
                .from("active_lost_pets_details")
                .select(`
        pet_id,
        pet_name,
        species,
        breed,
        color,
        gender,
        pet_photo_url,
        distinguishing_marks,
        alert_id,
        alert_status,
        last_seen_at,
        last_seen_description,
        alert_notes,
        owner_name
      `)
                .eq("owner_phone", phoneNumber)
                .eq("alert_status", "active")
                .order("last_seen_at", { ascending: false });
            if (error) {
                console.error("❌ Error obteniendo mascotas con alertas activas:", error);
                return null;
            }
            console.log(`📊 Encontradas ${(activePets === null || activePets === void 0 ? void 0 : activePets.length) || 0} mascotas con alertas activas`);
            return activePets || [];
        }
        catch (error) {
            console.error("Error en getOwnerActiveLostPets:", error);
            return null;
        }
    });
}
/**
 * Función para validar que una mascota pertenece a un propietario específico
 * @param phoneNumber El número de teléfono del propietario
 * @param petId El ID de la mascota a validar
 * @returns Objeto con información de la mascota si es válida, null si no
 */
export function validatePetOwnership(phoneNumber, petId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Buscar el perfil del propietario
            const { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (profileError) {
                throw new Error(`Error buscando el perfil: ${profileError.message}`);
            }
            if (!profile) {
                throw new Error(`No se encontró un perfil con el número de teléfono: ${phoneNumber}`);
            }
            // Validar que la mascota pertenece al propietario
            const { data: pet, error: petError } = yield supabase
                .from("pets")
                .select("id, name, species, breed, gender, is_currently_lost")
                .eq("id", petId)
                .eq("owner_id", profile.id)
                .maybeSingle();
            if (petError) {
                throw new Error(`Error validando la mascota: ${petError.message}`);
            }
            return pet; // Retorna la mascota si existe y pertenece al propietario, null si no
        }
        catch (error) {
            console.error("Error en validatePetOwnership:", error);
            return null;
        }
    });
}
/**
 * Función optimizada para validar que una mascota pertenece a un propietario específico
 * Primero busca en active_lost_pets_details (más rápido para mascotas con alertas),
 * luego hace fallback a la tabla pets
 * @param phoneNumber El número de teléfono del propietario
 * @param petId El ID de la mascota a validar
 * @returns Objeto con información de la mascota si es válida, null si no
 */
export function validatePetOwnershipOptimized(phoneNumber, petId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Primero intentar con active_lost_pets_details (más rápido para mascotas con alertas)
            const { data: activePet, error: activeError } = yield supabase
                .from("active_lost_pets_details")
                .select("pet_id, pet_name, species, breed, gender, owner_phone")
                .eq("pet_id", petId)
                .eq("owner_phone", phoneNumber)
                .eq("alert_status", "active")
                .maybeSingle();
            if (!activeError && activePet) {
                console.log(`✅ Mascota encontrada en active_lost_pets_details: ${activePet.pet_name}`);
                return {
                    id: activePet.pet_id,
                    name: activePet.pet_name,
                    species: activePet.species,
                    breed: activePet.breed,
                    gender: activePet.gender,
                    is_currently_lost: true // Si está en active_lost_pets_details, está perdida
                };
            }
            // Fallback a la función original con tabla pets
            console.log(`🔄 Fallback a tabla pets para validar mascota ${petId}`);
            return yield validatePetOwnership(phoneNumber, petId);
        }
        catch (error) {
            console.error("Error en validatePetOwnershipOptimized:", error);
            return null;
        }
    });
}
/**
 * Función para crear una alerta de mascota perdida
 * @param phoneNumber El número de teléfono del propietario
 * @param petId El ID de la mascota perdida (opcional si solo tiene una mascota)
 * @param petName El nombre de la mascota (alternativa al ID)
 * @param alertData Datos de la alerta de pérdida
 * @returns El ID de la alerta creada o mensaje de error
 */
export function createLostPetAlert(phoneNumber, alertData, petId, petName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            // Validar datos mínimos requeridos
            if (!alertData.last_seen_at) {
                throw new Error("La fecha y hora de la última vez vista es obligatoria");
            }
            // Validar formato de fecha
            const lastSeenDate = new Date(alertData.last_seen_at);
            if (isNaN(lastSeenDate.getTime())) {
                throw new Error("El formato de la fecha no es válido");
            }
            // Obtener las mascotas del propietario
            const ownerPets = yield getOwnerPets(phoneNumber);
            if (!ownerPets) {
                throw new Error("No se pudo obtener la información del propietario o sus mascotas");
            }
            if (ownerPets.length === 0) {
                throw new Error("El propietario no tiene mascotas registradas");
            }
            let targetPet = null;
            // Si se proporciona un ID de mascota, validar que pertenece al propietario
            if (petId) {
                targetPet = yield validatePetOwnership(phoneNumber, petId);
                if (!targetPet) {
                    throw new Error("La mascota especificada no existe o no pertenece a este propietario");
                }
            }
            // Si se proporciona un nombre de mascota, buscarla entre las mascotas del propietario
            else if (petName) {
                const searchTerm = petName.toLowerCase().trim();
                // Buscar por nombre exacto primero
                let matchingPets = ownerPets.filter((pet) => pet.name.toLowerCase() === searchTerm);
                // Si no se encuentra coincidencia exacta, buscar por coincidencias parciales
                if (matchingPets.length === 0) {
                    matchingPets = ownerPets.filter((pet) => pet.name.toLowerCase().includes(searchTerm) ||
                        (pet.species && pet.species.toLowerCase().includes(searchTerm)) ||
                        (pet.breed && pet.breed.toLowerCase().includes(searchTerm)) ||
                        `${pet.name.toLowerCase()} ${(pet.species || "").toLowerCase()}`.includes(searchTerm) ||
                        `${pet.name.toLowerCase()} ${(pet.breed || "").toLowerCase()}`.includes(searchTerm));
                }
                if (matchingPets.length === 0) {
                    throw new Error(`No se encontró una mascota con el nombre "${petName}" para este propietario`);
                }
                if (matchingPets.length > 1) {
                    const petDetails = matchingPets
                        .map((p, index) => {
                        const statusInfo = p.is_currently_lost
                            ? " (YA REPORTADA COMO PERDIDA)"
                            : "";
                        return `${index + 1}. ${p.name} - ${p.species || "especie no especificada"} - ${p.breed || "raza no especificada"}${statusInfo}`;
                    })
                        .join("\n");
                    throw new Error(`Se encontraron múltiples mascotas con el nombre "${petName}":\n\n${petDetails}\n\nPor favor, sea más específico indicando también la especie o raza, por ejemplo: "${petName} perro" o "${petName} gato".`);
                }
                targetPet = matchingPets[0];
            }
            // Si no se proporciona ID ni nombre, pero solo tiene una mascota, usar esa
            else if (ownerPets.length === 1) {
                targetPet = ownerPets[0];
            }
            // Si tiene múltiples mascotas y no especifica cuál, mostrar las opciones
            else {
                const petList = ownerPets
                    .map((p) => {
                    const statusInfo = p.is_currently_lost
                        ? " (YA REPORTADA COMO PERDIDA)"
                        : "";
                    return `- ${p.name} (${p.species || "especie no especificada"})${statusInfo}`;
                })
                    .join("\n");
                throw new Error(`Tiene múltiples mascotas registradas. Por favor especifique el nombre de la mascota que se perdió:\n\n${petList}\n\nEjemplo: Use el nombre exacto como "Max" o "Luna"`);
            }
            // Verificar si ya existe una alerta activa para esta mascota usando la tabla optimizada
            const { data: existingAlert, error: checkError } = yield supabase
                .from("active_lost_pets_details")
                .select("alert_id, pet_name")
                .eq("pet_id", targetPet.id)
                .eq("alert_status", "active")
                .maybeSingle();
            if (checkError) {
                throw new Error(`Error verificando alertas existentes: ${checkError.message}`);
            }
            if (existingAlert) {
                throw new Error(`Ya existe una alerta activa para la mascota ${existingAlert.pet_name}`);
            }
            // Crear la alerta de mascota perdida
            // Nota: last_seen_location es un campo de geometría, por ahora lo incluimos en additional_info
            const locationInfo = (_a = alertData.last_seen_location) === null || _a === void 0 ? void 0 : _a.trim();
            const additionalInfoText = [
                (_b = alertData.additional_info) === null || _b === void 0 ? void 0 : _b.trim(),
                locationInfo ? `Ubicación: ${locationInfo}` : null,
            ]
                .filter(Boolean)
                .join(". ") || null;
            const { data: newAlert, error: alertError } = yield supabase
                .from("lost_pet_alerts")
                .insert({
                pet_id: targetPet.id,
                last_seen_at: alertData.last_seen_at,
                last_seen_description: ((_c = alertData.last_seen_description) === null || _c === void 0 ? void 0 : _c.trim()) || null,
                // last_seen_location: null, // Campo de geometría - por ahora no usado
                additional_info: additionalInfoText,
                status: "active",
            })
                .select("id")
                .single();
            if (alertError) {
                throw new Error(`Error creando la alerta: ${alertError.message}`);
            }
            // Actualizar el estado de la mascota a perdida
            const { error: updatePetError } = yield supabase
                .from("pets")
                .update({ is_currently_lost: true })
                .eq("id", targetPet.id);
            if (updatePetError) {
                console.error("Error actualizando el estado de la mascota:", updatePetError);
                // No fallar completamente, pero registrar el error
            }
            console.log(`Alerta de mascota perdida creada con ID: ${newAlert.id} para la mascota: ${targetPet.name}`);
            // 🚨 ENVÍO AUTOMÁTICO DE ALERTAS A LA CIUDAD
            try {
                console.log("🔔 Iniciando envío automático de alertas a la ciudad...");
                // Obtener información completa del dueño para enviar alertas
                const { data: ownerProfile, error: ownerError } = yield supabase
                    .from("profiles")
                    .select("id, phone_number, full_name, city")
                    .eq("phone_number", phoneNumber)
                    .single();
                if (ownerError || !ownerProfile || !ownerProfile.city) {
                    console.error("⚠️  No se pudo enviar alertas: Información del dueño incompleta");
                    console.error("Detalles:", ownerError || "Ciudad no registrada");
                    // No fallar la creación de alerta si el envío falla
                }
                else {
                    // Calcular edad de la mascota
                    let age = "Edad no especificada";
                    if (targetPet.birth_date) {
                        const birthDate = new Date(targetPet.birth_date);
                        const today = new Date();
                        const years = today.getFullYear() - birthDate.getFullYear();
                        const months = today.getMonth() - birthDate.getMonth();
                        if (years > 0) {
                            age = `${years} año${years > 1 ? 's' : ''}`;
                        }
                        else if (months > 0) {
                            age = `${months} mes${months > 1 ? 'es' : ''}`;
                        }
                        else {
                            age = "Menos de 1 mes";
                        }
                    }
                    // Preparar información para la alerta
                    const alertInfo = {
                        petName: targetPet.name,
                        species: targetPet.species || "No especificada",
                        breed: targetPet.breed || "No especificada",
                        gender: targetPet.gender || "No especificado",
                        age: age,
                        distinguishingMarks: targetPet.distinguishing_marks || "No especificadas",
                        lastSeenLocation: alertData.last_seen_description ||
                            additionalInfoText ||
                            "Ubicación no especificada"
                    };
                    // Determinar el número de Twilio a usar (prioridad: producción)
                    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || "+573052227183";
                    // Enviar alertas a la ciudad
                    const alertResult = yield sendLostPetAlertToCity(alertInfo, ownerProfile.city, phoneNumber, twilioPhoneNumber);
                    if (alertResult.success) {
                        console.log(`✅ Alertas enviadas exitosamente: ${alertResult.successfulSends}/${alertResult.totalRecipients}`);
                    }
                    else {
                        console.error(`⚠️  Error enviando alertas: ${alertResult.message}`);
                    }
                }
            }
            catch (alertError) {
                console.error("❌ Error en envío automático de alertas:", alertError);
                // No fallar la creación de alerta si el envío automático falla
            }
            return `Alerta de mascota perdida creada exitosamente para ${targetPet.name}. ID de alerta: ${newAlert.id}. La mascota ha sido marcada como perdida en el sistema.`;
        }
        catch (error) {
            console.error("Error en createLostPetAlert:", error);
            return null;
        }
    });
}
/**
 * Función para actualizar los datos de una mascota existente
 * @param phoneNumber El número de teléfono del propietario
 * @param petIdentifier El ID o nombre de la mascota a actualizar
 * @param petData Datos de la mascota a actualizar (todos opcionales excepto el identificador)
 * @returns Mensaje de confirmación o null si hubo un error
 */
export function updatePet(phoneNumber, petIdentifier, petData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validar que al menos un campo sea proporcionado para actualizar
            const fieldsToUpdate = Object.keys(petData).filter(key => petData[key] !== undefined &&
                petData[key] !== null &&
                petData[key] !== "");
            if (fieldsToUpdate.length === 0) {
                throw new Error("Debe proporcionar al menos un campo para actualizar");
            }
            // Buscar el perfil del propietario
            const { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (profileError) {
                throw new Error(`Error buscando el perfil: ${profileError.message}`);
            }
            if (!profile) {
                throw new Error(`No se encontró un perfil con el número de teléfono: ${phoneNumber}`);
            }
            // Buscar la mascota por ID o nombre
            let targetPet = null;
            // Primero intentar por ID si parece ser un UUID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(petIdentifier);
            if (isUUID) {
                const { data: petById, error: petByIdError } = yield supabase
                    .from("pets")
                    .select("id, name, species, breed, color, birth_date, gender, photo_url, distinguishing_marks")
                    .eq("id", petIdentifier)
                    .eq("owner_id", profile.id)
                    .maybeSingle();
                if (!petByIdError && petById) {
                    targetPet = petById;
                }
            }
            // Si no se encontró por ID, buscar por nombre
            if (!targetPet) {
                const { data: pets, error: petsError } = yield supabase
                    .from("pets")
                    .select("id, name, species, breed, color, birth_date, gender, photo_url, distinguishing_marks")
                    .eq("owner_id", profile.id);
                if (petsError) {
                    throw new Error(`Error buscando las mascotas: ${petsError.message}`);
                }
                if (!pets || pets.length === 0) {
                    throw new Error("El propietario no tiene mascotas registradas");
                }
                // Buscar por nombre (coincidencia exacta)
                const matchingPets = pets.filter(pet => pet.name.toLowerCase() === petIdentifier.toLowerCase().trim());
                if (matchingPets.length === 0) {
                    // Buscar por coincidencia parcial
                    const partialMatches = pets.filter(pet => pet.name.toLowerCase().includes(petIdentifier.toLowerCase().trim()));
                    if (partialMatches.length === 0) {
                        throw new Error(`No se encontró una mascota con el identificador "${petIdentifier}" para este propietario`);
                    }
                    if (partialMatches.length > 1) {
                        const petList = partialMatches
                            .map(p => `- ${p.name} (${p.species || "especie no especificada"})`)
                            .join("\n");
                        throw new Error(`Se encontraron múltiples mascotas que coinciden con "${petIdentifier}":\n\n${petList}\n\nPor favor, sea más específico con el nombre.`);
                    }
                    targetPet = partialMatches[0];
                }
                else if (matchingPets.length > 1) {
                    const petList = matchingPets
                        .map(p => `- ${p.name} (${p.species || "especie no especificada"})`)
                        .join("\n");
                    throw new Error(`Se encontraron múltiples mascotas con el nombre "${petIdentifier}":\n\n${petList}\n\nPor favor, proporcione el ID específico de la mascota.`);
                }
                else {
                    targetPet = matchingPets[0];
                }
            }
            // Preparar los datos para actualizar
            const updateData = {};
            if (petData.name && petData.name.trim() !== "") {
                updateData.name = petData.name.trim();
            }
            if (petData.species && petData.species.trim() !== "") {
                updateData.species = petData.species.trim();
            }
            if (petData.breed && petData.breed.trim() !== "") {
                updateData.breed = petData.breed.trim();
            }
            if (petData.color && petData.color.trim() !== "") {
                updateData.color = petData.color.trim();
            }
            if (petData.birth_date && petData.birth_date.trim() !== "") {
                updateData.birth_date = petData.birth_date.trim();
            }
            if (petData.gender && petData.gender.trim() !== "") {
                updateData.gender = petData.gender.trim();
            }
            if (petData.photo_url && petData.photo_url.trim() !== "") {
                updateData.photo_url = petData.photo_url.trim();
            }
            if (petData.distinguishing_marks && petData.distinguishing_marks.trim() !== "") {
                updateData.distinguishing_marks = petData.distinguishing_marks.trim();
            }
            // Actualizar la mascota
            const { error: updateError } = yield supabase
                .from("pets")
                .update(updateData)
                .eq("id", targetPet.id);
            if (updateError) {
                throw new Error(`Error actualizando la mascota: ${updateError.message}`);
            }
            console.log(`Mascota actualizada: ${targetPet.name} (ID: ${targetPet.id})`);
            // Crear mensaje de confirmación con los campos actualizados
            const updatedFields = [];
            if (updateData.name)
                updatedFields.push(`Nombre: ${updateData.name}`);
            if (updateData.species)
                updatedFields.push(`Especie: ${updateData.species}`);
            if (updateData.breed)
                updatedFields.push(`Raza: ${updateData.breed}`);
            if (updateData.color)
                updatedFields.push(`Color: ${updateData.color}`);
            if (updateData.birth_date)
                updatedFields.push(`Fecha de nacimiento: ${updateData.birth_date}`);
            if (updateData.gender)
                updatedFields.push(`Género: ${updateData.gender}`);
            if (updateData.photo_url)
                updatedFields.push(`Foto: ${updateData.photo_url}`);
            if (updateData.distinguishing_marks)
                updatedFields.push(`Marcas distintivas: ${updateData.distinguishing_marks}`);
            return `Mascota "${targetPet.name}" actualizada exitosamente. ${updatedFields.join(", ")}`;
        }
        catch (error) {
            console.error("Error en updatePet:", error);
            return null;
        }
    });
}
/**
 * Función unificada para crear un avistamiento/reporte de mascota encontrada
 * Si se proporciona alertId, automáticamente hace el match y envía notificación
 * @param finderPhone Número de teléfono de quien encontró la mascota
 * @param finderName Nombre de quien encontró la mascota
 * @param petDescription Descripción de la mascota encontrada
 * @param locationFound Ubicación donde se encontró
 * @param photoUrl URL de la foto de la mascota encontrada (opcional)
 * @param alertId ID de la alerta para hacer match automático (opcional)
 * @returns Objeto con resultado del avistamiento y match (si aplica) o null si hubo un error
 */
export function createFoundPetSighting(finderPhone, finderName, petDescription, locationFound, photoUrl, alertId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🔍 Creando avistamiento para finder: ${finderName} (${finderPhone})`);
            // 🆕 VALIDACIÓN OBLIGATORIA DE FOTO
            if (!photoUrl || photoUrl.trim() === "") {
                throw new Error("❌ La foto de la mascota encontrada es OBLIGATORIA. Por favor, solicita al usuario que tome y envíe una foto clara de la mascota antes de continuar.");
            }
            // Crear el avistamiento directamente con nombre y teléfono del finder
            const { data: newSighting, error: sightingError } = yield supabase
                .from("sightings")
                .insert({
                alert_id: alertId || null, // Si hay alertId, asociarlo inmediatamente
                name: finderName.trim(),
                phone: finderPhone.trim(),
                sighted_at: new Date().toISOString(),
                location_description: locationFound.trim(),
                comment: petDescription.trim(),
                photo_url: photoUrl.trim(), // Ahora siempre presente
                created_at: new Date().toISOString(),
            })
                .select("id")
                .single();
            if (sightingError) {
                throw new Error(`Error creando el avistamiento: ${sightingError.message}`);
            }
            console.log(`✅ Avistamiento de mascota encontrada creado con ID: ${newSighting.id}`);
            // Preparar resultado base
            const result = {
                success: true,
                sightingId: newSighting.id,
                isMatch: !!alertId,
                notificationSent: false,
                notificationError: null,
                pet: null,
                owner: null,
                finder: {
                    name: finderName,
                    phone: finderPhone,
                    location: locationFound,
                    description: petDescription,
                    photoUrl: photoUrl || null
                }
            };
            // Si no hay alertId, es solo un avistamiento sin match
            if (!alertId) {
                console.log(`📝 Avistamiento registrado sin match. ID: ${newSighting.id}`);
                return result;
            }
            // Si hay alertId, hacer el match automático y enviar notificación
            console.log(`🔗 Procesando match automático con alerta: ${alertId}`);
            // Validar que el alertId sea un UUID válido
            if (!isValidUUID(alertId)) {
                throw new Error(`El ID de la alerta no es válido: ${alertId}`);
            }
            try {
                // Obtener información de la mascota y alerta
                const { data: alertData, error: alertError } = yield supabase
                    .from("lost_pet_alerts")
                    .select(`id, pet_id`)
                    .eq("id", alertId)
                    .single();
                if (alertError) {
                    throw new Error(`Error obteniendo datos de la alerta: ${alertError.message}`);
                }
                // Obtener información de la mascota
                const { data: petData, error: petError } = yield supabase
                    .from("pets")
                    .select(`name, species, breed, owner_id`)
                    .eq("id", alertData.pet_id)
                    .single();
                if (petError) {
                    throw new Error(`Error obteniendo datos de la mascota: ${petError.message}`);
                }
                // Obtener información del dueño
                const { data: ownerData, error: ownerError } = yield supabase
                    .from("profiles")
                    .select("full_name, phone_number")
                    .eq("id", petData.owner_id)
                    .single();
                if (ownerError) {
                    throw new Error(`Error obteniendo datos del dueño: ${ownerError.message}`);
                }
                // Agregar información del match al resultado
                result.pet = {
                    name: petData.name,
                    species: petData.species,
                    breed: petData.breed
                };
                result.owner = {
                    name: ownerData.full_name || 'No especificado',
                    phone: ownerData.phone_number
                };
                // Enviar notificación de Twilio automáticamente
                try {
                    console.log(`📱 Enviando notificación automática a ${ownerData.phone_number}...`);
                    yield sendPetSightingNotification(ownerData.phone_number, ownerData.full_name || 'Propietario', petData.name, finderName, finderPhone, photoUrl // Ahora obligatorio
                    );
                    result.notificationSent = true;
                    console.log(`✅ Notificación enviada exitosamente`);
                }
                catch (notificationError) {
                    console.error(`❌ Error enviando notificación:`, notificationError);
                    result.notificationError = notificationError.message;
                }
                console.log(`🎯 Match confirmado entre avistamiento ${newSighting.id} y alerta ${alertId}`);
            }
            catch (matchError) {
                console.error(`❌ Error en el match automático:`, matchError);
                result.notificationError = `Error en match: ${matchError.message}`;
            }
            return result;
        }
        catch (error) {
            console.error("Error en createFoundPetSighting:", error);
            return null;
        }
    });
}
//todo --------------------------------------------------------------
/**
 * Función para confirmar el match y notificar al dueño
 * @param sightingId ID del avistamiento
 * @param alertId ID de la alerta de mascota perdida
 * @returns Objeto con información del match y resultado de la notificación o null si hubo un error
 */
export function confirmPetMatch(sightingId, alertId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validar que los IDs sean UUIDs válidos
            if (!isValidUUID(sightingId)) {
                throw new Error(`El ID del avistamiento no es válido. Se recibió: "${sightingId}". Por favor, asegúrese de registrar primero el avistamiento con createFoundPetSightingTool para obtener un ID válido.`);
            }
            if (!isValidUUID(alertId)) {
                throw new Error(`El ID de la alerta no es válido. Se recibió: "${alertId}". Por favor, verifique que el ID de la alerta sea correcto.`);
            }
            // Actualizar el avistamiento con el alert_id confirmado
            const { error: updateError } = yield supabase
                .from("sightings")
                .update({ alert_id: alertId })
                .eq("id", sightingId);
            if (updateError) {
                throw new Error(`Error actualizando el avistamiento: ${updateError.message}`);
            }
            // Obtener información del avistamiento incluyendo datos del finder
            const { data: sightingData, error: sightingError } = yield supabase
                .from("sightings")
                .select(`
        id,
        location_description,
        comment,
        photo_url,
        sighted_at,
        name,
        phone
      `)
                .eq("id", sightingId)
                .single();
            if (sightingError) {
                throw new Error(`Error obteniendo datos del avistamiento: ${sightingError.message}`);
            }
            // Obtener información de la mascota y alerta
            const { data: alertData, error: alertError } = yield supabase
                .from("lost_pet_alerts")
                .select(`
        id,
        pet_id
      `)
                .eq("id", alertId)
                .single();
            if (alertError) {
                throw new Error(`Error obteniendo datos de la alerta: ${alertError.message}`);
            }
            // Obtener información de la mascota
            const { data: petData, error: petError } = yield supabase
                .from("pets")
                .select(`
        name,
        species,
        breed,
        owner_id
      `)
                .eq("id", alertData.pet_id)
                .single();
            if (petError) {
                throw new Error(`Error obteniendo datos de la mascota: ${petError.message}`);
            }
            // Obtener información del dueño
            const { data: ownerData, error: ownerError } = yield supabase
                .from("profiles")
                .select("full_name, phone_number")
                .eq("id", petData.owner_id)
                .single();
            if (ownerError) {
                throw new Error(`Error obteniendo datos del dueño: ${ownerError.message}`);
            }
            // Preparar datos estructurados para retornar
            const matchResult = {
                success: true,
                pet: {
                    name: petData.name,
                    species: petData.species,
                    breed: petData.breed
                },
                owner: {
                    name: ownerData.full_name || 'No especificado',
                    phone: ownerData.phone_number
                },
                finder: {
                    name: sightingData.name || 'No especificado',
                    phone: sightingData.phone,
                    location: sightingData.location_description,
                    description: sightingData.comment,
                    photoUrl: sightingData.photo_url,
                    sightedAt: sightingData.sighted_at
                },
                notificationSent: false,
                notificationError: null
            };
            // Enviar notificación de Twilio automáticamente
            try {
                console.log(`📱 Enviando notificación automática a ${ownerData.phone_number}...`);
                // Validar que exista foto antes de enviar
                if (!sightingData.photo_url) {
                    throw new Error("No se puede enviar notificación sin foto de la mascota encontrada");
                }
                yield sendPetSightingNotification(ownerData.phone_number, ownerData.full_name || 'Propietario', petData.name, sightingData.name, sightingData.phone, sightingData.photo_url // Ahora obligatorio
                );
                matchResult.notificationSent = true;
                console.log(`✅ Notificación enviada exitosamente`);
            }
            catch (notificationError) {
                console.error(`❌ Error enviando notificación:`, notificationError);
                matchResult.notificationError = notificationError.message;
            }
            console.log(`Match confirmado entre avistamiento ${sightingId} y alerta ${alertId}`);
            return matchResult;
        }
        catch (error) {
            console.error("Error en confirmPetMatch:", error);
            return null;
        }
    });
}
/**
 * Función para enviar notificación de avistamiento de mascota perdida a través de Twilio
 * @param ownerPhone Número de teléfono del dueño de la mascota
 * @param ownerName Nombre del dueño de la mascota
 * @param petName Nombre de la mascota
 * @param finderName Nombre de la persona que encontró la mascota
 * @param finderPhone Teléfono de la persona que encontró la mascota
 * @param photoUrl URL de la foto de la mascota encontrada (OBLIGATORIO)
 * @returns void
 */
export const sendPetSightingNotification = (ownerPhone, ownerName, petName, finderName, finderPhone, photoUrl) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Validar que la foto sea obligatoria
        if (!photoUrl || photoUrl.trim() === "") {
            throw new Error("La foto de la mascota encontrada es obligatoria para enviar la notificación");
        }
        const templateUrl = "https://ultim.online/olfatea/send-template";
        const testTemplateUrl = "http://localhost:3025/olfatea/send-template";
        // Nuevo template con foto incluida
        const templateId = "HX9c9550cf8b2b2173871f1e9b46e022de";
        // Extraer el patch URL de la foto completa de Firebase (formato: o/images%2F...)
        const photoPatchUrl = extractPatchUrlFromFirebase(photoUrl);
        console.log(`📸 Foto patch URL extraído: ${photoPatchUrl}`);
        const requestData = {
            to: ownerPhone,
            templateId: templateId,
            ownerName: ownerName || "Dueño",
            petName: petName || "Mascota",
            finderName: finderName || "Alguien",
            finderPhone: finderPhone || "No proporcionado",
            photoPatchUrl: photoPatchUrl, // Patch URL con formato o/images%2F...
            twilioPhoneNumber: "+573052227183" // Prioridad a producción
        };
        console.log(`📝 Enviando notificación con foto a ${ownerPhone}`);
        console.log(`📸 Finder: ${finderName} (${finderPhone})`);
        const response = yield axios.post(templateUrl, requestData);
        console.log(`✅ Notificación de avistamiento enviada exitosamente a ${ownerPhone}:`, response.data);
        console.log(`📱 Template usado: ${templateId} - Dueño: ${ownerName}, Mascota: ${petName}`);
        console.log(`📸 Foto incluida en template: ${photoPatchUrl}`);
    }
    catch (error) {
        if (error.response) {
            console.error(`❌ Error enviando notificación de avistamiento:`, error.response.data);
        }
        else if (error.request) {
            console.error(`❌ No response from server:`, error.request);
        }
        else {
            console.error(`❌ Error:`, error.message);
        }
        // Re-lanzar el error para que el caller pueda manejarlo
        throw new Error(`Error enviando notificación: ${error.message}`);
    }
});
//! Prueba de consulta con Supabase Function
/**
 * Llama a la función RPC 'search_lost_pets_by_text' en Supabase para buscar mascotas perdidas.
 * @param userDescription La descripción en lenguaje natural de la mascota encontrada.
 * @returns Un objeto con los resultados o un error.
 */
export function searchLostPetsFTS(userDescription) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🔎 Ejecutando búsqueda FTS en Supabase con: "${userDescription}"`);
        if (!userDescription || userDescription.trim() === "") {
            return { error: "La descripción para buscar no puede estar vacía." };
        }
        const { data: matches, error } = yield supabase.rpc('search_lost_pets_by_text', {
            search_text: userDescription,
            match_count: 5, // Traemos los 5 mejores resultados
        });
        if (error) {
            console.error("Error en la búsqueda Full-Text Search:", error);
            return { error: "Hubo un error técnico al realizar la búsqueda." };
        }
        if (!matches || matches.length === 0) {
            console.log("✅ Búsqueda FTS completada sin resultados.");
            return { results: [], message: "No se encontraron mascotas que coincidan." };
        }
        console.log(`✅ Búsqueda FTS exitosa. Se encontraron ${matches.length} resultados.`);
        return {
            results: matches,
            message: `Se encontraron ${matches.length} posibles coincidencias.`
        };
    });
}
/**
 * Función para validar si el perfil de un usuario está completo para suscribirse
 * @param phoneNumber El número de teléfono del usuario
 * @returns Objeto con estado del perfil y campos faltantes
 */
export function validateCompleteProfile(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🔍 Validando perfil completo para ${phoneNumber}...`);
            // Buscar el perfil del usuario
            const { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id, phone_number, full_name, email, city, country, neighborhood, subscription_status")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (profileError) {
                throw new Error(`Error buscando el perfil: ${profileError.message}`);
            }
            if (!profile) {
                console.log(`❌ No se encontró perfil para ${phoneNumber}`);
                return {
                    isComplete: false,
                    missingFields: ["full_name", "email", "city", "country", "neighborhood"],
                    profile: null
                };
            }
            // Definir campos obligatorios para suscripción
            const requiredFields = [
                { field: "full_name", value: profile.full_name },
                { field: "email", value: profile.email },
                { field: "city", value: profile.city },
                { field: "country", value: profile.country },
                { field: "neighborhood", value: profile.neighborhood }
            ];
            // Identificar campos faltantes
            const missingFields = requiredFields
                .filter(({ value }) => !value || value.trim() === "")
                .map(({ field }) => field);
            const isComplete = missingFields.length === 0;
            console.log(`✅ Validación de perfil completa. Completo: ${isComplete}, Campos faltantes: ${missingFields.join(", ")}`);
            return {
                isComplete,
                missingFields,
                profile
            };
        }
        catch (error) {
            console.error("Error en validateCompleteProfile:", error);
            return {
                isComplete: false,
                missingFields: ["full_name", "email", "city", "country", "neighborhood"],
                profile: null
            };
        }
    });
}
/**
 * Función para iniciar el proceso de suscripción con un plan específico
 * @param phoneNumber El número de teléfono del usuario
 * @param planId El ID del plan seleccionado por el usuario
 * @returns Objeto con información del proceso y datos bancarios
 */
export function initiateSubscriptionProcess(phoneNumber, planId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🚀 Iniciando proceso de suscripción para ${phoneNumber} con plan ${planId}...`);
            // Validar que el plan existe y está activo
            const planDetails = yield getPlanDetails(planId);
            if (!planDetails) {
                return {
                    success: false,
                    profileComplete: false,
                    missingFields: [],
                    bankInfo: {
                        bank: "",
                        accountType: "",
                        accountNumber: "",
                        accountHolder: "",
                        nit: "",
                        amount: "$0 COP",
                        concept: ""
                    },
                    message: "El plan seleccionado no es válido o no está disponible. Por favor, selecciona un plan válido."
                };
            }
            // Validar perfil completo
            const profileValidation = yield validateCompleteProfile(phoneNumber);
            // Información bancaria con el precio del plan seleccionado
            const formattedPrice = planDetails.price.toLocaleString('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0
            });
            const bankInfo = {
                bank: "Bancolombia",
                accountType: "Cuenta de Ahorros",
                accountNumber: "33191746681",
                accountHolder: "Olfatea SAS",
                nit: "123.456.789-1",
                amount: formattedPrice,
                concept: `Suscripción ${planDetails.name} - Olfatea`
            };
            if (!profileValidation.isComplete) {
                console.log(`⚠️ Perfil incompleto. Campos faltantes: ${profileValidation.missingFields.join(", ")}`);
                return {
                    success: false,
                    profileComplete: false,
                    missingFields: profileValidation.missingFields,
                    planSelected: {
                        id: planDetails.id,
                        name: planDetails.name,
                        price: planDetails.price,
                        pet_limit: planDetails.pet_limit
                    },
                    bankInfo,
                    message: `Para continuar con la suscripción al ${planDetails.name}, necesito que completes tu información de perfil. Faltan los siguientes datos: ${profileValidation.missingFields.join(", ")}.`
                };
            }
            console.log(`✅ Perfil completo. Guardando plan seleccionado y mostrando información de pago para ${planDetails.name}...`);
            // Guardar el plan seleccionado en el perfil del usuario
            const { error: updatePlanError } = yield supabase
                .from("profiles")
                .update({ plan_id: planDetails.id })
                .eq("phone_number", phoneNumber);
            if (updatePlanError) {
                console.error("Error guardando plan en perfil:", updatePlanError);
                return {
                    success: false,
                    profileComplete: true,
                    missingFields: [],
                    bankInfo,
                    message: `Error técnico guardando el plan seleccionado: ${updatePlanError.message}`
                };
            }
            console.log(`💾 Plan ${planDetails.name} guardado exitosamente en el perfil`);
            return {
                success: true,
                profileComplete: true,
                missingFields: [],
                planSelected: {
                    id: planDetails.id,
                    name: planDetails.name,
                    price: planDetails.price,
                    pet_limit: planDetails.pet_limit
                },
                bankInfo,
                message: `Tu perfil está completo. Aquí tienes la información para realizar el pago del ${planDetails.name} (${formattedPrice} anuales).`
            };
        }
        catch (error) {
            console.error("Error en initiateSubscriptionProcess:", error);
            return {
                success: false,
                profileComplete: false,
                missingFields: ["full_name", "email", "city", "country", "neighborhood"],
                bankInfo: {
                    bank: "Bancolombia",
                    accountType: "Cuenta de Ahorros",
                    accountNumber: "33191746681",
                    accountHolder: "Olfatea SAS",
                    nit: "123.456.789-1",
                    amount: "$0 COP",
                    concept: "Suscripción Olfatea"
                },
                message: `Error técnico iniciando el proceso de suscripción: ${error}`
            };
        }
    });
}
/**
 * Función auxiliar para activar automáticamente una suscripción
 * ACTUALIZADA: Crea registro en user_subscriptions en lugar de actualizar profiles
 * Lee el plan_id del perfil y crea una nueva suscripción activa
 * @param phoneNumber El número de teléfono del usuario
 * @returns Objeto con resultado de la activación
 */
export function activateSubscriptionAutomatically(phoneNumber, planIdentifier) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🚀 Activando suscripción automáticamente para ${phoneNumber}...`);
            // Obtener perfil (necesitamos el ID del usuario)
            const { data: profile, error: profileError } = yield supabase
                .from("profiles")
                .select("id, plan_id")
                .eq("phone_number", phoneNumber)
                .maybeSingle();
            if (profileError) {
                throw new Error(`Error obteniendo perfil: ${profileError.message}`);
            }
            if (!profile) {
                return {
                    success: false,
                    error: "Perfil no encontrado"
                };
            }
            // Determinar qué plan activar
            // Prioridad 1: El plan pasado explícitamente (input del usuario/chat)
            // Prioridad 2: El plan guardado en el perfil (fallback para compatibilidad)
            let planToUse = planIdentifier;
            if (!planToUse && profile.plan_id) {
                console.log(`ℹ️ No se especificó plan, usando fallback del perfil: ${profile.plan_id}`);
                planToUse = profile.plan_id;
            }
            if (!planToUse) {
                return {
                    success: false,
                    error: "No hay plan seleccionado para activar"
                };
            }
            // Obtener detalles del plan
            // Intentamos primero con findPlanByName que maneja alias ("huellita", "premium")
            // Si falla, intentamos getPlanDetails que maneja IDs y búsquedas parciales
            let planDetails = yield findPlanByName(planToUse);
            if (!planDetails) {
                planDetails = yield getPlanDetails(planToUse);
            }
            if (!planDetails) {
                return {
                    success: false,
                    error: `Plan no válido o no encontrado: "${planToUse}"`
                };
            }
            // Calcular fechas de activación y expiración
            const now = new Date();
            const activatedAt = now.toISOString();
            const expiresAt = new Date(now.getTime() + (planDetails.duration_months * 30 * 24 * 60 * 60 * 1000));
            const expiresAtISO = expiresAt.toISOString();
            // CREAR REGISTRO EN user_subscriptions (NUEVO ENFOQUE)
            const { data: newSubscription, error: subscriptionError } = yield supabase
                .from("user_subscriptions")
                .insert({
                user_id: profile.id,
                plan_id: planDetails.id,
                subscription_status: "active",
                activated_at: activatedAt,
                expires_at: expiresAtISO
            })
                .select()
                .single();
            if (subscriptionError) {
                throw new Error(`Error creando suscripción: ${subscriptionError.message}`);
            }
            console.log(`✅ Suscripción creada en user_subscriptions: ID ${newSubscription.id}`);
            // Actualizar is_subscriber en profiles (para indicador rápido)
            const { error: updateProfileError } = yield supabase
                .from("profiles")
                .update({ is_subscriber: true })
                .eq("id", profile.id);
            if (updateProfileError) {
                console.error("⚠️ Error actualizando is_subscriber en profile:", updateProfileError);
                // No fallar si esto falla, la suscripción ya fue creada
            }
            console.log(`✅ Suscripción activada exitosamente: ${planDetails.name} hasta ${expiresAt.toLocaleDateString('es-CO')}`);
            return {
                success: true,
                planName: planDetails.name,
                planPrice: planDetails.price,
                expiresAt: expiresAtISO
            };
        }
        catch (error) {
            console.error("Error en activateSubscriptionAutomatically:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido"
            };
        }
    });
}
/**
 * Función para procesar el comprobante de pago y notificar al admin
 * @param phoneNumber El número de teléfono del usuario
 * @param proofImageUrl La URL de la imagen del comprobante
 * @returns Objeto con resultado del procesamiento
 */
// En src/utils/functions.ts
/**
 * Función para procesar el comprobante de pago y notificar al admin
 * ACTUALIZADA: Permite recibir el planIdentifier para asignarlo antes de activar
 */
export function processPaymentProof(phoneNumber, proofImageUrl, planIdentifier // 🆕 Nuevo parámetro opcional
) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🧾 Procesando comprobante de pago para ${phoneNumber}...`);
            // 1. Validar URL de imagen (código existente...)
            if (!proofImageUrl || !proofImageUrl.trim()) {
                return {
                    success: false,
                    adminNotified: false,
                    subscriptionStatus: "inactive",
                    message: "La URL del comprobante es requerida.",
                    error: "URL de imagen faltante"
                };
            }
            try {
                new URL(proofImageUrl);
            }
            catch ( /* manejo de error existente */_a) { /* manejo de error existente */ }
            // 🆕 2. (MODIFICADO) Ya no asignamos el plan al perfil para evitar conflictos en multi-suscripción.
            // El plan se pasará directamente a la función de activación.
            if (planIdentifier && planIdentifier.trim() !== "") {
                console.log(`📝 Plan proporcionado explícitamente: "${planIdentifier}". Se usará para la activación directa.`);
            }
            // 3. Validar perfil completo (código existente...)
            const profileValidation = yield validateCompleteProfile(phoneNumber);
            // ... (bloques de validación de perfil existentes: if !profile, if !isComplete) ...
            if (!profileValidation.profile) { /* ... return error ... */ }
            if (!profileValidation.isComplete) { /* ... return error ... */ }
            // 4. INTENTAR ACTIVAR SUSCRIPCIÓN AUTOMÁTICAMENTE
            console.log(`🚀 Activando suscripción automáticamente...`);
            // Pasamos el planIdentifier directamente a la función
            const activationResult = yield activateSubscriptionAutomatically(phoneNumber, planIdentifier);
            if (!activationResult.success) {
                console.error("Error activando suscripción:", activationResult.error);
                // 🚨 CAMBIO CRÍTICO AQUÍ:
                // Si el error es porque no hay plan, NO lo mandamos a "pending". 
                // Le decimos a la IA que pregunte el plan.
                if (activationResult.error === "No hay plan seleccionado para activar") {
                    return {
                        success: false,
                        adminNotified: false,
                        subscriptionStatus: "inactive", // No lo ponemos en pending
                        message: "⚠️ NO SE PUDO ACTIVAR: El usuario envió el comprobante pero no sé qué plan compró. Por favor, pregúntale qué plan eligió para poder activarlo.",
                        error: "PLAN_NOT_SELECTED" // Código de error para que la IA sepa qué hacer
                    };
                }
                // Solo si es otro error técnico, hacemos el fallback a pending
                const { error: updateError } = yield supabase
                    .from("profiles")
                    .update({ subscription_status: "pending" })
                    .eq("phone_number", phoneNumber);
                // ... resto del manejo de error existente ...
                return {
                    success: false,
                    adminNotified: false,
                    subscriptionStatus: "pending",
                    message: `Error técnico activando. Solicitud marcada como pendiente. Detalle: ${activationResult.error}`,
                    error: activationResult.error
                };
            }
            // ... (Resto de la función: Log de éxito, envío de emails, retorno de éxito) ...
            // Asegúrate de mantener el código que envía el email y retorna success: true
            // (Código existente para enviar email y retornar success)
            let adminNotified = false;
            try {
                yield sendAdminNotificationEmail(profileValidation.profile, proofImageUrl, true, activationResult);
                adminNotified = true;
            }
            catch (e) { }
            const expiresDate = activationResult.expiresAt ? new Date(activationResult.expiresAt).toLocaleDateString('es-CO') : 'fecha no disponible';
            return {
                success: true,
                adminNotified,
                subscriptionStatus: "active",
                message: `🎉 ¡Pago validado y plan activado! Tu suscripción al ${activationResult.planName} está activa hasta el ${expiresDate}.` // Mensaje simplificado
            };
        }
        catch (error) {
            console.error("Error en processPaymentProof:", error);
            return {
                success: false,
                adminNotified: false,
                subscriptionStatus: "inactive",
                message: `Error técnico: ${error}`,
                error: String(error)
            };
        }
    });
}
/**
 * Función para enviar email de notificación al admin sobre nueva suscripción
 * @param profileData Datos del perfil del usuario
 * @param proofImageUrl URL de la imagen del comprobante
 * @param isAutoActivated Si la suscripción ya fue activada automáticamente
 * @param activationData Datos de la activación (solo si isAutoActivated es true)
 * @returns void
 */
export function sendAdminNotificationEmail(profileData_1, proofImageUrl_1) {
    return __awaiter(this, arguments, void 0, function* (profileData, proofImageUrl, isAutoActivated = false, activationData) {
        try {
            console.log(`📧 Enviando notificación de suscripción al admin...`);
            // Configurar transporter de nodemailer con SendGrid
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT || "587"),
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.SENDGRID_API_KEY,
                },
            });
            // HTML template para el email
            const emailTitle = isAutoActivated ? "Suscripción Activada Automáticamente" : "Nueva Suscripción Pendiente";
            const headerColor = isAutoActivated ? "#28a745" : "#4CAF50";
            const statusIcon = isAutoActivated ? "✅" : "🕐";
            const statusText = isAutoActivated ? "ACTIVADA" : "PENDIENTE";
            // Obtener información del plan si está disponible
            const planInfo = activationData ? {
                name: activationData.planName || 'Plan no especificado',
                price: activationData.planPrice || 0,
                expiresAt: activationData.expiresAt ? new Date(activationData.expiresAt).toLocaleDateString('es-CO') : 'No disponible'
            } : {
                name: 'Plan no especificado',
                price: 0,
                expiresAt: 'No disponible'
            };
            const emailHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${emailTitle} - Olfatea</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${headerColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
        .user-info { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .info-row { display: flex; margin: 10px 0; }
        .info-label { font-weight: bold; min-width: 120px; }
        .proof-section { background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background-color: ${headerColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { background-color: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .status-active { background-color: #d4edda; border-left: 4px solid #28a745; }
        .status-pending { background-color: #fff3cd; border-left: 4px solid #ffc107; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🐾 ${emailTitle} - Olfatea</h1>
        </div>
        
        <div class="content">
          ${isAutoActivated ?
                '<p><strong>✅ Una suscripción ha sido activada automáticamente!</strong></p>' :
                '<p><strong>🕐 Tienes una nueva solicitud de suscripción para validar!</strong></p>'}
          
          <div class="user-info">
            <h3>📋 Datos del Usuario</h3>
            <div class="info-row">
              <span class="info-label">Nombre Completo:</span>
              <span>${profileData.full_name || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Teléfono:</span>
              <span>${profileData.phone_number}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span>${profileData.email || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Ciudad:</span>
              <span>${profileData.city || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">País:</span>
              <span>${profileData.country || 'No especificado'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Barrio:</span>
              <span>${profileData.neighborhood || 'No especificado'}</span>
            </div>
          </div>

          <div class="proof-section">
            <h3>🧾 Comprobante de Pago</h3>
            <p>El usuario ha enviado el siguiente comprobante de pago:</p>
            <a href="${proofImageUrl}" target="_blank" class="button">Ver Comprobante de Pago</a>
            <p><small>URL: ${proofImageUrl}</small></p>
          </div>

          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8; margin-top: 20px;">
            <h4>💰 Detalles de la Suscripción:</h4>
            <p><strong>Plan:</strong> ${planInfo.name}<br>
            <strong>Monto:</strong> ${planInfo.price.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}<br>
            <strong>Estado:</strong> ${statusIcon} ${statusText}<br>
            ${isAutoActivated ? `<strong>Expira:</strong> ${planInfo.expiresAt}<br>` : ''}
            <strong>Fecha de Solicitud:</strong> ${new Date().toLocaleString('es-CO')}</p>
          </div>

          <div class="${isAutoActivated ? 'status-active' : 'status-pending'}" style="padding: 15px; border-radius: 8px; margin-top: 20px;">
            ${isAutoActivated ? `
              <h4>✅ Suscripción Activada Automáticamente</h4>
              <p><strong>La suscripción ya está activa y el usuario puede usar todos los servicios.</strong></p>
              <h5>🔍 Acciones de Validación Pendientes:</h5>
              <ol>
                <li>Verificar que el comprobante de pago sea válido</li>
                <li>Confirmar que el pago haya llegado a la cuenta de Olfatea</li>
                <li>Si hay algún problema, desactivar la suscripción desde el panel administrativo</li>
                <li>Si todo está correcto, no se requiere acción adicional</li>
              </ol>
              <p><strong>⚠️ Nota:</strong> Si detectas algún problema con el pago, puedes desactivar la suscripción desde el panel administrativo.</p>
            ` : `
              <h4>⚡ Acciones a Realizar:</h4>
              <ol>
                <li>Verificar el comprobante de pago haciendo clic en el botón superior</li>
                <li>Validar que el monto sea correcto</li>
                <li>Confirmar que el pago haya llegado a la cuenta de Olfatea</li>
                <li>Si todo está correcto, activar la suscripción en el panel administrativo</li>
                <li>Notificar al usuario vía WhatsApp sobre la activación</li>
              </ol>
            `}
          </div>
        </div>

        <div class="footer">
          <p>Este es un mensaje automático del sistema de suscripciones de Olfatea.<br>
          ${isAutoActivated ?
                'La suscripción fue activada automáticamente. Valida el pago cuando sea posible.' :
                'Por favor, procesa esta solicitud lo antes posible.'}</p>
          <small>Fecha: ${new Date().toLocaleString('es-CO')}</small>
        </div>
      </div>
    </body>
    </html>`;
            // Configurar opciones del email
            const emailSubject = isAutoActivated
                ? `✅ Suscripción Activada Automáticamente - ${profileData.full_name || 'Usuario'} (${profileData.phone_number})`
                : `🕐 Nueva Suscripción Pendiente - ${profileData.full_name || 'Usuario'} (${profileData.phone_number})`;
            const mailOptions = {
                from: '"Olfatea - Sistema Automático" <contacto@olfatea.com>',
                to: "contacto@olfatea.com",
                cc: [
                    "mariana.b@ultimmarketing.com"
                ],
                subject: emailSubject,
                html: emailHtml
            };
            // Enviar el email
            yield transporter.sendMail(mailOptions);
            console.log(`✅ Email de notificación enviado exitosamente al admin`);
        }
        catch (error) {
            console.error(`❌ Error enviando email de notificación al admin:`, error);
            throw new Error(`Error enviando email de notificación: ${error.message}`);
        }
    });
}
/**
 * Función para enviar email de bienvenida a nuevo suscriptor
 * @param profileData Datos del perfil del usuario
 * @returns void
 */
export function sendWelcomeEmail(profileData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`📧 Enviando email de bienvenida a ${profileData.full_name || 'usuario'}...`);
            // Configurar transporter de nodemailer con SendGrid
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT || "587"),
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.SENDGRID_API_KEY,
                },
            });
            // HTML template para el email de bienvenida
            const emailHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>¡Bienvenido a Olfatea! 🐾</title>
      <style>
        body { 
          font-family: 'Arial', sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f4f4f4; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: white; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px; 
          font-weight: bold; 
        }
        .header p { 
          margin: 10px 0 0 0; 
          font-size: 16px; 
          opacity: 0.9; 
        }
        .content { 
          padding: 40px 30px; 
        }
        .welcome-message { 
          background: linear-gradient(135deg, #f8fff8 0%, #e8f5e8 100%); 
          padding: 25px; 
          border-radius: 10px; 
          margin: 20px 0; 
          border-left: 4px solid #4CAF50; 
        }
        .user-info { 
          background-color: #f9f9f9; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 25px 0; 
        }
        .feature-list { 
          background-color: #fff3e0; 
          padding: 25px; 
          border-radius: 10px; 
          margin: 25px 0; 
        }
        .feature-item { 
          display: flex; 
          align-items: center; 
          margin: 15px 0; 
          padding: 10px 0; 
        }
        .feature-icon { 
          font-size: 24px; 
          margin-right: 15px; 
          min-width: 30px; 
        }
        .cta-section { 
          text-align: center; 
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); 
          padding: 30px; 
          border-radius: 10px; 
          margin: 30px 0; 
        }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
          color: white; 
          padding: 15px 30px; 
          text-decoration: none; 
          border-radius: 25px; 
          font-weight: bold; 
          font-size: 16px; 
          margin: 15px 0; 
          box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3); 
          transition: all 0.3s ease; 
        }
        .footer { 
          background-color: #333; 
          color: white; 
          padding: 30px; 
          text-align: center; 
        }
        .footer p { 
          margin: 5px 0; 
        }
        .social-links { 
          margin: 20px 0; 
        }
        .social-links a { 
          color: #4CAF50; 
          text-decoration: none; 
          margin: 0 10px; 
          font-weight: bold; 
        }
        .highlight { 
          color: #4CAF50; 
          font-weight: bold; 
        }
        @media (max-width: 600px) {
          .container { margin: 10px; }
          .content, .header, .footer { padding: 20px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🐾 ¡Bienvenido a Olfatea!</h1>
          <p>Tu compañero digital para cuidar a tus mascotas</p>
        </div>
        
        <div class="content">
          <div class="welcome-message">
            <h2>¡Hola ${profileData.full_name || 'querido usuario'}! 👋</h2>
            <p style="font-size: 18px; margin: 15px 0;">
              <strong>¡Muchas gracias por ser parte de la familia Olfatea!</strong> 
              Nos emociona muchísimo tenerte con nosotros en esta increíble aventura de cuidar y proteger a nuestras mascotas.
            </p>
            <p style="font-size: 16px; color: #666;">
              Tu suscripción ha sido <span class="highlight">activada exitosamente</span> y ya puedes disfrutar de todos los beneficios que tenemos para ti y tus peludos compañeros.
            </p>
          </div>

          <div class="user-info">
            <h3>📋 Tu Información de Suscripción</h3>
            <p><strong>📱 Teléfono:</strong> ${profileData.phone_number}</p>
            <p><strong>📧 Email:</strong> ${profileData.email || 'No especificado'}</p>
            <p><strong>🏙️ Ciudad:</strong> ${profileData.city || 'No especificado'}</p>
            <p><strong>✅ Estado:</strong> <span class="highlight">Suscripción Activa</span></p>
            <p><strong>⏰ Duración:</strong> 12 meses de protección total</p>
          </div>

          <div class="feature-list">
            <h3>🎉 ¿Qué puedes hacer ahora con Olfatea?</h3>
            
            <div class="feature-item">
              <div class="feature-icon">🐕</div>
              <div>
                <strong>Registra tus mascotas:</strong> Crea perfiles completos con fotos y detalles únicos de cada una de tus mascotas
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">🚨</div>
              <div>
                <strong>Alertas de búsqueda:</strong> Si tu mascota se pierde, activa alertas inmediatas para encontrarla más rápido
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">👀</div>
              <div>
                <strong>Reporta avistamientos:</strong> Ayuda a otros dueños reportando mascotas que encuentres en la calle
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">🤖</div>
              <div>
                <strong>Asistente IA 24/7:</strong> Conversa con nuestro chatbot inteligente para resolver dudas y recibir ayuda
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">🌍</div>
              <div>
                <strong>Red de apoyo:</strong> Forma parte de una comunidad que se cuida mutuamente
              </div>
            </div>
          </div>

          <div class="cta-section">
            <h3>🚀 ¡Comienza ahora mismo!</h3>
            <p>No pierdas tiempo, empieza a proteger a tus mascotas hoy mismo. 
            Simplemente envía un mensaje por WhatsApp y nuestro asistente te guiará paso a paso.</p>
            <a href="https://wa.me/5742044644" class="button">Empezar en WhatsApp 💬</a>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              También puedes escribirnos directamente al <strong>+57 420 44644</strong>
            </p>
          </div>

          <div style="background-color: #fff8e1; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 25px 0;">
            <h4>💡 Consejos para aprovechar al máximo Olfatea:</h4>
            <ul style="margin: 15px 0; padding-left: 20px;">
              <li>Registra todas tus mascotas con fotos claras y detalles únicos</li>
              <li>Mantén actualizada tu información de contacto</li>
              <li>Si encuentras una mascota perdida, repórtala inmediatamente</li>
              <li>Comparte Olfatea con otros dueños de mascotas en tu zona</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%); border-radius: 10px;">
            <h3>💝 ¡Gracias por confiar en nosotros!</h3>
            <p style="font-size: 18px; margin: 15px 0;">
              En Olfatea creemos que <strong>cada mascota merece estar segura y protegida</strong>. 
              Tu suscripción nos ayuda a seguir creciendo y mejorando nuestros servicios para toda la comunidad.
            </p>
            <p style="font-size: 16px; color: #666;">
              Si tienes cualquier pregunta o sugerencia, no dudes en contactarnos. 
              ¡Estamos aquí para ayudarte! 🐾❤️
            </p>
          </div>
        </div>

        <div class="footer">
          <p><strong>🐾 Equipo Olfatea</strong></p>
          <p>Tu red de protección para mascotas</p>
          
          <div class="social-links">
            <a href="mailto:contacto@olfatea.com">📧 contacto@olfatea.com</a>
            <a href="https://wa.me/5742044644">💬 WhatsApp</a>
          </div>
          
          <p style="font-size: 14px; opacity: 0.8; margin-top: 20px;">
            Este email fue enviado a ${profileData.email || profileData.phone_number}<br>
            <small>Fecha de activación: ${new Date().toLocaleDateString('es-CO')}</small>
          </p>
        </div>
      </div>
    </body>
    </html>`;
            // Configurar opciones del email
            const mailOptions = {
                from: '"Olfatea - Bienvenida" <soporte@olfatea.com>',
                to: profileData.email,
                subject: `🐾 ¡Bienvenido a Olfatea, ${profileData.full_name || 'querido usuario'}! Tu suscripción está activa`,
                html: emailHtml
            };
            // Enviar el email
            yield transporter.sendMail(mailOptions);
            console.log(`✅ Email de bienvenida enviado exitosamente a ${profileData.email}`);
        }
        catch (error) {
            console.error(`❌ Error enviando email de bienvenida:`, error);
            throw new Error(`Error enviando email de bienvenida: ${error.message}`);
        }
    });
}
//! ================== PRUEBAS ==================
// let profileData = {
//   full_name: "Alejandro Betancur",
//   phone_number: "+573001234567",
//   email: "alejandro.betancur@example.com"
// };
// let proofImageUrl = "https://firebasestorage.googleapis.com/v0/b/coltefinanciera-8a40a.appspot.com/o/images%2FComprobante%20de%20prueba.png?alt=media&token=8d955651-a67a-430f-aaac-23909500e787";
// sendAdminNotificationEmail( profileData, proofImageUrl );
//! ================== FUNCIONES DE PRUEBA PARA PLANES ==================
/**
 * Función de prueba para validar la funcionalidad de planes
 * Esta función está comentada para evitar ejecución accidental
 */
/*
export async function testPlanFunctionality() {
  console.log("🧪 Iniciando pruebas de funcionalidad de planes...");
  
  try {
    // 1. Probar obtener planes disponibles
    console.log("\n1. Probando getAvailablePlans():");
    const plans = await getAvailablePlans();
    console.log(`📋 Se encontraron ${plans.length} planes:`, plans);
    
    // 2. Probar obtener detalles de un plan específico
    if (plans.length > 0) {
      console.log("\n2. Probando getPlanDetails():");
      const planDetails = await getPlanDetails(plans[0].id);
      console.log(`📋 Detalles del plan ${plans[0].name}:`, planDetails);
    }
    
    // 3. Probar validación de límites para un usuario de prueba
    console.log("\n3. Probando validatePetLimit():");
    const testPhone = "+573001234567"; // Cambiar por un número real
    const limitValidation = await validatePetLimit(testPhone);
    console.log("🔢 Validación de límites:", limitValidation);
    
    // 4. Probar suscripción con información de plan
    console.log("\n4. Probando hasActiveSubscription():");
    const subscriptionStatus = await hasActiveSubscription(testPhone);
    console.log("💳 Estado de suscripción:", subscriptionStatus);
    
    console.log("\n✅ Todas las pruebas completadas exitosamente!");
    
  } catch (error) {
    console.error("❌ Error en las pruebas:", error);
  }
}

// Para ejecutar las pruebas, descomenta la línea siguiente:
// testPlanFunctionality();
*/
//! ================== FUNCIONES PARA ALERTAS DE MASCOTAS PERDIDAS ==================
/**
 * Función para normalizar nombres de ciudades y permitir coincidencias
 * Remueve acentos, convierte a minúsculas y maneja variaciones comunes
 * @param city El nombre de la ciudad a normalizar
 * @returns El nombre de la ciudad normalizado
 */
export function normalizeCityName(city) {
    if (!city || city.trim() === "") {
        return "";
    }
    // Convertir a minúsculas y remover espacios extra
    let normalized = city.toLowerCase().trim();
    // Reemplazar caracteres acentuados
    const accentsMap = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
        'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
        'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
        'ã': 'a', 'õ': 'o', 'ñ': 'n', 'ç': 'c'
    };
    normalized = normalized.split('').map(char => accentsMap[char] || char).join('');
    // Remover caracteres especiales excepto espacios
    normalized = normalized.replace(/[^a-z0-9\s]/g, '');
    // Reemplazar múltiples espacios por uno solo
    normalized = normalized.replace(/\s+/g, ' ').trim();
    console.log(`🏙️  Ciudad normalizada: "${city}" → "${normalized}"`);
    return normalized;
}
/**
 * Función para obtener usuarios de una ciudad específica
 * @param city El nombre de la ciudad (se normaliza automáticamente)
 * @param excludePhone Número de teléfono a excluir (ej: el dueño de la mascota)
 * @returns Array de usuarios de la ciudad o array vacío si hay error
 */
export function getUsersByCity(city, excludePhone) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`🔍 Buscando usuarios en la ciudad: ${city}`);
            if (!city || city.trim() === "") {
                console.log("⚠️  Ciudad no especificada");
                return [];
            }
            const normalizedCity = normalizeCityName(city);
            // Obtener todos los usuarios con ciudad definida
            const { data: allUsers, error } = yield supabase
                .from("profiles")
                .select("id, phone_number, full_name, city")
                .not("city", "is", null)
                .not("phone_number", "is", null);
            if (error) {
                console.error("Error obteniendo usuarios:", error);
                return [];
            }
            if (!allUsers || allUsers.length === 0) {
                console.log("📭 No se encontraron usuarios con ciudad definida");
                return [];
            }
            // Filtrar usuarios por ciudad normalizada
            const cityUsers = allUsers.filter(user => {
                const userCityNormalized = normalizeCityName(user.city || "");
                const matches = userCityNormalized === normalizedCity;
                // Excluir el teléfono especificado si se proporciona
                if (matches && excludePhone && user.phone_number === excludePhone) {
                    return false;
                }
                return matches;
            });
            console.log(`✅ Encontrados ${cityUsers.length} usuarios en ${city} (excluyendo ${excludePhone || 'ninguno'})`);
            return cityUsers;
        }
        catch (error) {
            console.error("Error en getUsersByCity:", error);
            return [];
        }
    });
}
/**
 * Función para enviar alertas de mascota perdida a todos los usuarios de una ciudad
 * Template ID: HX9ac62fa46bf8a8cba672f9d31d4031fb
 * Variables: {{1}} nombre, {{2}} especie/raza, {{3}} género/edad, {{4}} señas, {{5}} ubicación
 * @param alertInfo Información de la alerta de mascota perdida
 * @param ownerCity Ciudad del dueño (se normaliza automáticamente)
 * @param ownerPhone Teléfono del dueño (para excluirlo de los envíos)
 * @param twilioPhoneNumber Número de Twilio desde el cual enviar
 * @returns Resultado del envío masivo con estadísticas
 */
export function sendLostPetAlertToCity(alertInfo, ownerCity, ownerPhone, twilioPhoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = twilio(accountSid, authToken);
        const templateId = "HX9ac62fa46bf8a8cba672f9d31d4031fb";
        const statusCallbackUrl = process.env.STATUS_CALLBACK_URL || "https://ultim.online";
        const result = {
            success: false,
            totalRecipients: 0,
            successfulSends: 0,
            failedSends: 0,
            sentMessages: [],
            message: ""
        };
        try {
            console.log("🚨 === INICIANDO ENVÍO MASIVO DE ALERTA ===");
            console.log(`📍 Ciudad: ${ownerCity}`);
            console.log(`🐾 Mascota: ${alertInfo.petName}`);
            // Obtener usuarios de la misma ciudad
            const cityUsers = yield getUsersByCity(ownerCity, ownerPhone);
            result.totalRecipients = cityUsers.length;
            if (cityUsers.length === 0) {
                result.message = `No se encontraron usuarios en la ciudad ${ownerCity} para notificar`;
                console.log("⚠️  " + result.message);
                return result;
            }
            console.log(`👥 Se enviarán ${cityUsers.length} alertas`);
            // Preparar variables del template
            // {{1}} nombre, {{2}} especie/raza, {{3}} género/edad, {{4}} señas, {{5}} ubicación
            const contentVariables = JSON.stringify({
                1: alertInfo.petName,
                2: `${alertInfo.species}/${alertInfo.breed}`,
                3: `${alertInfo.gender}/${alertInfo.age}`,
                4: alertInfo.distinguishingMarks || "No especificadas",
                5: alertInfo.lastSeenLocation
            });
            // Enviar mensajes con delay entre cada uno (para evitar rate limiting)
            for (const user of cityUsers) {
                try {
                    console.log(`📤 Enviando a ${user.phone_number} (${user.full_name || 'Sin nombre'})`);
                    const message = yield client.messages.create({
                        from: `whatsapp:${twilioPhoneNumber}`,
                        to: `whatsapp:${user.phone_number}`,
                        contentSid: templateId,
                        contentVariables: contentVariables,
                        statusCallback: `${statusCallbackUrl}/olfatea/webhook/status`,
                    });
                    result.sentMessages.push({
                        phone: user.phone_number,
                        name: user.full_name,
                        sid: message.sid,
                        success: true
                    });
                    result.successfulSends++;
                    console.log(`✅ Enviado exitosamente - SID: ${message.sid}`);
                    // Delay de 500ms entre mensajes para evitar rate limiting
                    yield new Promise(resolve => setTimeout(resolve, 500));
                }
                catch (sendError) {
                    console.error(`❌ Error enviando a ${user.phone_number}:`, sendError.message);
                    result.sentMessages.push({
                        phone: user.phone_number,
                        name: user.full_name,
                        sid: '',
                        success: false,
                        error: sendError.message
                    });
                    result.failedSends++;
                }
            }
            // Construir mensaje de resultado
            result.success = result.successfulSends > 0;
            result.message = `Alertas enviadas: ${result.successfulSends}/${result.totalRecipients}. Fallidos: ${result.failedSends}`;
            console.log("📊 === RESUMEN DE ENVÍO MASIVO ===");
            console.log(`Total destinatarios: ${result.totalRecipients}`);
            console.log(`Exitosos: ${result.successfulSends}`);
            console.log(`Fallidos: ${result.failedSends}`);
            console.log("=====================================");
            return result;
        }
        catch (error) {
            console.error("❌ Error crítico en sendLostPetAlertToCity:", error);
            result.message = `Error crítico: ${error instanceof Error ? error.message : 'Error desconocido'}`;
            return result;
        }
    });
}
/**
 * Función para obtener la foto y detalles de una mascota perdida por su nombre
 * Consulta la tabla active_lost_pets_details
 * @param petName El nombre de la mascota a buscar
 * @returns Objeto con detalles de la mascota y alerta, o null si no se encuentra
 */
export function getLostPetPhotoByName(petName) {
    return __awaiter(this, void 0, void 0, function* () {
        // console.log(`🔎 Buscando foto de mascota perdida: "${petName}"`);
        if (!petName || petName.trim() === "") {
            return null;
        }
        // Usamos ilike para búsqueda insensible a mayúsculas/minúsculas
        const { data, error } = yield supabase
            .from('active_lost_pets_details')
            .select('alert_id, pet_name, species, breed, gender, pet_photo_url, last_seen_description, alert_notes, owner_name, owner_phone')
            .ilike('pet_name', petName.trim())
            .limit(1);
        if (error) {
            console.error("❌ Error al buscar foto de mascota perdida:", error.message);
            return null;
        }
        if (!data || data.length === 0) {
            return null;
        }
        return data[0];
    });
}
