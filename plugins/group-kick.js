const { cmd } = require('../command');

cmd({
    pattern: "kick",
    alias: ["remove", "k"],
    desc: "Removes a user from the group by reply or mention",
    category: "admin",
    react: "❌",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isGroup) return reply("📛 *Group only command!*");
        if (!isAdmins) return reply("📛 *You must be a group admin!*");
        if (!isBotAdmins) return reply("📛 *Bot must be admin to remove!*");

        let targetJid;

        // Check mention first
        const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentioned && mentioned.length > 0) {
            targetJid = mentioned[0];
        }
        // Otherwise use reply
        else if (mek.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = mek.message.extendedTextMessage.contextInfo.participant;
        }
        else {
            return reply("⚠️ *Please reply to a user or @mention them to kick!*");
        }

        // Prevent kicking the bot itself
        const botJid = conn.user.id.split(':')[0] + "@s.whatsapp.net";
        if (targetJid === botJid) {
            return reply("😅 *I can't remove myself!*");
        }

        // Remove participant
        await conn.groupParticipantsUpdate(from, [targetJid], "remove");
        
        // Confirm removal
        await conn.sendMessage(from, {
            text: `✅ *Removed:* @${targetJid.split("@")[0]}`,
            mentions: [targetJid]
        });

    } catch (err) {
        console.error("Kick Error:", err);

        // Better error feedback
        let errMsg = "❌ *Failed to remove user!*";
        if (err?.output?.statusCode === 409) {
            errMsg = "⚠️ *Cannot remove this user (maybe admin or permissions issue)*";
        }
        reply(errMsg);
    }
});
