
import { supabase } from './supabase';

const handleGeminiRequest = async (prompt, imageBase64 = null) => {
    try {
        // 1. Fetch API Key from Settings
        const { data: settingsData, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'google_api_key')
            .single();

        if (error || !settingsData?.value) {
            throw new Error('Google Gemini API Key no configurada. Ve al Panel de Control > Configuración.');
        }

        const apiKey = settingsData.value;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        // Construct payload
        const contents = [
            {
                parts: [
                    { text: prompt }
                ]
            }
        ];

        // If image is provided, add inline data
        if (imageBase64) {
            contents[0].parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64
                }
            });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();

        if (data.error) {
            console.error('Gemini Error:', data.error);
            throw new Error(data.error.message || 'Error desconocido de Google Gemini');
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Respuesta vacía de Gemini.');
        }

        return text;

    } catch (error) {
        console.error('Error Gemini Service:', error);
        throw error;
    }
};

export const generateMarketingCopy = async (promoTitle, promoDescription, products = []) => {
    const productNames = products.map(p => p.name).join(', ');
    const prompt = `Eres un experto en marketing digital para WhatsApp. Escribe 3 opciones de mensajes promocionales cortos, persuasivos y con emojis, para esta oferta:
    - Título: ${promoTitle}
    - Descripción: ${promoDescription}
    - Productos: ${productNames}
    
    Formato:
    OPCIÓN 1: [Texto]
    OPCIÓN 2: [Texto]
    OPCIÓN 3: [Texto]`;

    return handleGeminiRequest(prompt);
};

export const analyzeReceipt = async (imageBase64) => {
    const prompt = `Analiza esta imagen de recibo/factura y extrae los siguientes datos en formato JSON puro (sin markdown, solo el objeto JSON):
    {
      "total": number (el monto total pagado),
      "date": string (fecha en formato YYYY-MM-DD, si no hay año asume el actual),
      "vendor": string (nombre del comercio),
      "items": string (descripción resumida de lo comprado, ej: "Cuadernos y lapiceras")
    }
    Si no encuentras un dato, usa null.`;

    const result = await handleGeminiRequest(prompt, imageBase64);

    // Clean result if it comes with markdown code blocks
    const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanResult);
};
