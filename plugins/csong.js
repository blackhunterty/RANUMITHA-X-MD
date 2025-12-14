const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ytdl = require("ytdl-core"); // make sure to install: npm i ytdl-core

// Fake vCard
const fakevCard = {
  key: {
    fromMe: false,
    participant: "0@s.whatsapp.net",
    remoteJid: "status@broadcast"
  },
  message: {
    contactMessage: {
      displayName: "© Mr Hiruka",
      vcard: `BEGIN:VCARD
VERSION:3.0
FN:Meta
ORG:META AI;
TEL;type=CELL;type=VOICE;waid=94762095304:+94762095304
END:VCARD`
    }
  }
};

// Convert "3:17" → seconds
function toSeconds(time) {
  if (!time) return 0;
  const p = time.split(":").map(Number);
  return p.length === 2 ? p[0] * 60 + p[1] : parseInt(time);
}

cmd({
  pattern: "csong",
  alias: ["chsong", "channelplay"],
  react: "🍁",
  desc: "Send a YouTube song to a WhatsApp Channel",
  category: "channel",
  use: ".csong <song name or YouTube link> /<channel JID>",
  filename: __filename,
}, async (conn, mek, m, { reply, q }) => {
  try {
    if (!q) return reply("⚠️ Format:\n.csong <song or link> /<channel JID>");

    let cleaned = q.trim();
    let lastSlash = cleaned.lastIndexOf("/");
    if (lastSlash === -1)
      return reply("⚠️ Format:\n.csong <song or link> /<channel JID>");

    let input = cleaned.substring(0, lastSlash).trim();
    let channelJid = cleaned.substring(lastSlash + 1).trim();

    if (!channelJid.endsWith("@newsletter"))
      return reply("❌ Invalid channel JID! Must end with @newsletter");

    const isYT = input.includes("youtu");

    let videoInfo;
    if (isYT) {
      // ✅ YouTube link download using ytdl-core
      videoInfo = await ytdl.getInfo(input);
    } else {
      // 🔍 Search fallback (use YouTube search API or Nekolabs search)
      return reply("⚠️ Only YouTube link supported in this version.");
    }

    const meta = {
      title: videoInfo.videoDetails.title,
      duration: videoInfo.videoDetails.lengthSeconds,
      channel: videoInfo.videoDetails.author.name,
      cover: videoInfo.videoDetails.thumbnails[videoInfo.videoDetails.thumbnails.length - 1].url
    };

    const dlUrl = ytdl(input, { filter: "audioonly", quality: "highestaudio" });

    // Temp path
    const tmpPath = path.join(__dirname, "../temp", `song_${Date.now()}.mp3`);
    const writeStream = fs.createWriteStream(tmpPath);

    // Download audio
    await new Promise((resolve, reject) => {
      dlUrl.pipe(writeStream);
      dlUrl.on("end", resolve);
      dlUrl.on("error", reject);
    });

    // Send audio to channel
    await conn.sendMessage(channelJid, {
      audio: fs.readFileSync(tmpPath),
      mimetype: "audio/mpeg",
      ptt: false,
      caption: `🎵 *${meta.title}*\n⏳ Duration: ${toSeconds(meta.duration)} seconds\n📺 Channel: ${meta.channel}`
    }, { quoted: fakevCard });

    fs.unlinkSync(tmpPath);

    reply(`✅ Sent *${meta.title}* to ${channelJid}`);

  } catch (err) {
    console.error(err);
    reply("⚠️ Error while sending song.");
  }
});
