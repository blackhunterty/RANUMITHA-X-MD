const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

cmd({
    pattern: "songx",
    react: "🎵",
    desc: "Download YouTube MP3",
    category: "download",
    use: ".song <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        // === QUERY HANDLING START ===
        let query = q?.trim();

        if (!query && m?.quoted) {
            query =
                m.quoted.message?.conversation ||
                m.quoted.message?.extendedTextMessage?.text ||
                m.quoted.text;
        }

        if (!query) {
            return reply(
                "⚠️ Please provide a song name or YouTube link (or reply to a message)."
            );
        }
        // === QUERY HANDLING END ===

        // Detect if the text is a YouTube Shorts link and convert to normal link
        if (query.match(/(https?:\/\/)?(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/)) {
            const videoID = query.match(/shorts\/([a-zA-Z0-9_-]+)/)[1];
            query = `https://www.youtube.com/watch?v=${videoID}`;
        }

        let data;
        // If query is a YouTube link, skip search
        if (query.match(/(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/)) {
            const videoID = query.split('v=')[1];
            const searchResult = await yts({ videoId: videoID });
            data = searchResult.videos[0];
        } else {
            // Normal search
            const searchResult = await yts(query);
            if (!searchResult.videos.length) return reply("❌ No results found for your query.");
            data = searchResult.videos[0];
        }

        const ytUrl = data.url;

        // Download start reaction
        await conn.sendMessage(from, { react: { text: "⬇️", key: m.key } });

        const api = `https://gtech-api-xtp1.onrender.com/api/audio/yt?apikey=APIKEY&url=${encodeURIComponent(ytUrl)}`;
        const { data: apiRes } = await axios.get(api);

        if (!apiRes?.status || !apiRes.result?.media?.audio_url) {
            return reply("❌ Unable to download the song. Please try another one!");
        }

        const result = apiRes.result.media;

        const caption = `
🎵 *Song Downloader.* 📥

📑 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
📆 *Uploaded:* ${data.ago}
📊 *Views:* ${data.views}
🔗 *Link:* ${data.url}

🔢 *Reply Below Number*

1️⃣ *Audio Type*
2️⃣ *Document Type*
3️⃣ *Voice Note*

> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: result.thumbnail },
            caption
        }, { quoted: m });

        const messageID = sentMsg.key.id;

        conn.ev.on("messages.upsert", async (msgData) => {
            const receivedMsg = msgData.messages[0];
            if (!receivedMsg?.message) return;

            const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
            const senderID = receivedMsg.key.remoteJid;
            const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (!isReplyToBot) return;

            const tempPath = path.join(__dirname, `temp_${Date.now()}.mp3`);
            const voicePath = path.join(__dirname, `voice_${Date.now()}.opus`);
            const dlUrl = result.audio_url;

            try {
                // Upload start reaction
                await conn.sendMessage(senderID, { react: { text: "⬆️", key: receivedMsg.key } });

                if (receivedText.trim() === "1") {
                    await conn.sendMessage(senderID, {
                        audio: { url: dlUrl },
                        mimetype: "audio/mpeg",
                        ptt: false
                    }, { quoted: receivedMsg });

                } else if (receivedText.trim() === "2") {
                    await conn.sendMessage(senderID, {
                        document: { url: dlUrl },
                        mimetype: "audio/mpeg",
                        fileName: `${data.title}.mp3`
                    }, { quoted: receivedMsg });

                } else if (receivedText.trim() === "3") {
                    // Download and convert to Opus
                    const audioRes = await axios.get(dlUrl, { responseType: 'arraybuffer' });
                    fs.writeFileSync(tempPath, Buffer.from(audioRes.data));

                    await new Promise((resolve, reject) => {
                        ffmpeg(tempPath)
                            .audioCodec("libopus")
                            .format("opus")
                            .audioBitrate("64k")
                            .save(voicePath)
                            .on("end", resolve)
                            .on("error", reject);
                    });

                    const voiceBuffer = fs.readFileSync(voicePath);

                    await conn.sendMessage(senderID, {
                        audio: voiceBuffer,
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true
                    }, { quoted: receivedMsg });

                    fs.unlinkSync(tempPath);
                    fs.unlinkSync(voicePath);

                } else {
                    // Invalid option reaction
                    await conn.sendMessage(senderID, { react: { text: "❌", key: receivedMsg.key } });
                    return;
                }

                // Success reaction
                await conn.sendMessage(senderID, { react: { text: "✔️", key: receivedMsg.key } });

            } catch (err) {
                console.error("Error sending audio:", err);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath);
                await conn.sendMessage(senderID, { react: { text: "❌", key: receivedMsg.key } });
            }
        });

    } catch (error) {
        console.error("Song Command Error:", error);
        reply("❌ An error occurred while processing your request. Please try again later.");
    }
});
