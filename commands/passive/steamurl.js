const Axios = require('axios');
const Discord = require('discord.js');
const { spawn } = require('child_process');
const Path = require('path');

module.exports = {
    async execute(message, url) {
        STEAM_PROT_PREFIX = "steam://openurl/"
        const steamed_url = `Open in Steam: ${STEAM_PROT_PREFIX}${url}`
        const msg = await message.reply(steamed_url, {allowedMentions: {repliedUser: false}})
            .catch(error => console.error("Failed to send steamed URL.", error));
        msg.suppressEmbeds(true);
    },
}