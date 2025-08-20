import express from "express";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { createAgentWithPhone } from "../agents/mainAgent";
import { HumanMessage } from "@langchain/core/messages";
import twilio from "twilio";
import { savePetAppMessage } from "../utils/saveChatHistory";
import { initializeApp } from "firebase/app";
import { OpenAI, toFile } from "openai";
import fetch from "node-fetch";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { ElevenLabsClient } from "elevenlabs";
import { getAvailableForAudio } from "../utils/getAvailableForAudio";
import { getAvailableChatOn } from "../utils/getAvailableChatOn";

dotenv.config();

const router = express.Router();

const MessagingResponse = twilio.twiml.MessagingResponse; // mandar un texto simple
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken); // mandar un texto con media
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// ElevenLabs Client
const elevenlabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const createAudioStreamFromText = async (text: string): Promise<Buffer> => {
  const audioStream = await elevenlabsClient.generate({
    voice: "Andrea",
    model_id: "eleven_flash_v2_5",
    text,
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk);
  }

  const content = Buffer.concat(chunks);
  return content;
};

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const storage = getStorage();

let exportedFromNumber: string | undefined;

// Ruta para enviar mensajes de WhatsApp
router.post("/pet-app-chatbot/send-message", async (req, res) => {
  const { to, body } = req.body;

  console.log(req.body);

  try {
    const message = await client.messages.create({
      // from: "whatsapp:+5745012081",
      from: "whatsapp:+14155238886",
      to: `whatsapp:${to}`,
      body: body,
    });

    res
      .status(200)
      .json({ success: true, message: "Mensaje enviado", sid: message.sid });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al enviar el mensaje",
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});

// chat endpoint para recibir mensajes con twilio
router.post("/pet-app-chatbot/receive-message", async (req, res) => {
  const twiml = new MessagingResponse();
  const from = req.body.From;
  const to = req.body.To;
  const fromNumber = from.slice(from.indexOf(":") + 1);
  const twilioSid = req.body.MessageSid; // Capturamos el SID del mensaje entrante

  // Asignar el número de teléfono para exportar
  exportedFromNumber = fromNumber;

  try {
    let incomingMessage;
    let userMediaUrl = req.body.MediaUrl0 || undefined; // Capturamos la URL del media entrante

    // ... (lógica de transcripción de audio, sin cambios)
    if (
      req.body.MediaContentType0 &&
      req.body.MediaContentType0.includes("audio")
    ) {
      // ... tu código de transcripción
      incomingMessage = "Transcripción de audio..."; // Reemplazar con la transcripción real
    } else {
      incomingMessage = req.body.Body;
    }

    // --- PUNTO 1: GUARDAR MENSAJE DE USUARIO ---
    await savePetAppMessage(
      fromNumber,
      incomingMessage,
      "user",
      userMediaUrl,
      twilioSid
    );

    // Validar si en el dashboard se encuentra activado el chat
    const chatOn = await getAvailableChatOn(fromNumber);

    if (!chatOn) {
      const config = { configurable: { thread_id: fromNumber } };

      // Crear agente con el número de teléfono específico
      const agentWithPhone = createAgentWithPhone(fromNumber);

      const agentOutput = await agentWithPhone.invoke(
        {
          messages: [new HumanMessage(incomingMessage)],
        },
        config
      );

      const lastMessage = agentOutput.messages[agentOutput.messages.length - 1];

      if (!lastMessage || typeof lastMessage.content !== "string") {
        throw new Error("La IA no generó una respuesta válida.");
      }

      const responseMessage = lastMessage.content;
      console.log("Respuesta IA:", responseMessage);

      const isAvailableForAudio = await getAvailableForAudio(fromNumber);

      // --- PUNTO 2 y 3: ENVIAR Y GUARDAR RESPUESTA DEL BOT ---
      if (
        isAvailableForAudio &&
        responseMessage.length <= 600 &&
        !/\d/.test(responseMessage)
      ) {
        // Lógica para enviar audio
        const audioBuffer = await createAudioStreamFromText(responseMessage);
        const audioName = `${uuidv4()}.wav`;
        const storageRef = ref(storage, `audios/${audioName}`);
        // ... (código de subida a Firebase)

        // 👇 Esperamos la URL de Firebase
        const audioUrl = await getDownloadURL(storageRef);

        // Enviamos el mensaje con media a Twilio
        const sentMessage = await client.messages.create({
          from: to,
          to: from,
          mediaUrl: [audioUrl],
        });

        // Guardamos en DB la respuesta del bot CON la URL y el SID del mensaje saliente
        await savePetAppMessage(
          fromNumber,
          responseMessage,
          "bot",
          audioUrl,
          sentMessage.sid
        );

        console.log("Audio message sent and saved successfully");
        res.writeHead(200, { "Content-Type": "text/xml" });
        res.end(twiml.toString());
      } else {
        // Lógica para enviar texto
        const sentMessage = await client.messages.create({
          body: responseMessage,
          from: to, // Asegúrate de usar la variable correcta
          to: from,
        });

        // Guardamos en DB la respuesta del bot CON el SID del mensaje saliente
        await savePetAppMessage(
          fromNumber,
          responseMessage,
          "bot",
          undefined,
          sentMessage.sid
        );

        console.log("Text message sent and saved successfully");
        res.writeHead(200, { "Content-Type": "text/xml" });
        res.end(twiml.toString());
      }
    } else {
      // Si el chat está en modo "humano", no hacemos nada con la IA
      // pero el mensaje del usuario ya quedó guardado.
      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end(twiml.toString());
    }
  } catch (error) {
    console.error("Error in chat route:", error);
    // Es buena práctica responder a Twilio incluso si hay un error
    twiml.message(
      "Hubo un error procesando tu mensaje. Por favor, intenta de nuevo."
    );
    res.status(500).type("text/xml").send(twiml.toString());
  }
});

// Ruta principal
router.get("/pet-app-chatbot/chat-test", (req, res) => {
  res.send(
    "Chat de Pet App funcionando correctamente con Typescript y Express."
  );
});

export default router;

export { exportedFromNumber };
