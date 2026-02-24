export default async function handler(req, res) {
    const text = req.query.text || req.body?.text || '';
    const voice = req.query.voice || 'Leda';

    if (!text) {
        return res.status(400).json({ error: 'Missing text parameter' });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text }] }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voice }
                            }
                        }
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.candidates) {
            console.error('Gemini error:', JSON.stringify(data));
            return res.status(500).json({ error: 'TTS API failed', details: data });
        }

        const base64Audio = data.candidates[0].content.parts[0].inlineData.data;
        const pcm = Buffer.from(base64Audio, 'base64');
        const wav = pcmToWav(pcm, 1, 24000, 16);

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(wav);

    } catch (err) {
        console.error('TTS error:', err);
        res.status(500).json({ error: err.message });
    }
}

function pcmToWav(pcmBuffer, numChannels, sampleRate, bitDepth) {
    const dataSize = pcmBuffer.length;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * bitDepth / 8, 28);
    header.writeUInt16LE(numChannels * bitDepth / 8, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, pcmBuffer]);
}
