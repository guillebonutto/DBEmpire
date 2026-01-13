
import { supabase } from './supabase';

const handleOpenAIRequest = async (prompt) => {
    try {
        // 1. Fetch API Key from Settings
        const { data: settingsData, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'openai_api_key')
            .single();

        if (error || !settingsData?.value) {
            throw new Error('API Key de OpenAI no configurada. Ve al Panel de Control > Configuración.');
        }

        const apiKey = settingsData.value;
        const url = 'https://api.openai.com/v1/chat/completions';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto en marketing digital para WhatsApp. Escribes mensajes cortos, persuasivos y con emojis, diseñados para vender productos de tecnología y accesorios."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('OpenAI Error Response:', data.error);
            throw new Error(data.error.message || 'Error desconocido de OpenAI');
        }

        if (!data.choices || data.choices.length === 0) {
            console.error('OpenAI Empty Choices:', data);
            throw new Error('La IA no devolvió ninguna sugerencia. Intenta de nuevo.');
        }

        const content = data.choices[0].message?.content;
        if (!content) {
            console.error('OpenAI Empty Content:', data.choices[0]);
            throw new Error('Respuesta vacía de la IA.');
        }

        return content;

    } catch (error) {
        console.error('Error OpenAI Service Detailed:', error);
        throw error;
    }
};

export const generateMarketingCopy = async (promoTitle, promoDescription, products = []) => {
    const productNames = products.map(p => p.name).join(', ');
    const prompt = `Genera 3 opciones de mensajes promocionales para enviar por WhatsApp sobre esta oferta:
    - Título: ${promoTitle}
    - Descripción: ${promoDescription}
    - Productos incluidos: ${productNames}
    
    El formato debe ser:
    OPCIÓN 1: [Texto]
    OPCIÓN 2: [Texto]
    OPCIÓN 3: [Texto]
    `;

    return handleOpenAIRequest(prompt);
};
