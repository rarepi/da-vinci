import Discord from "discord.js"

const RGX_STEAM_URL = /^(?:[^\r\n]+ )*<?((?:https?:\/\/)?(?:\w+\.)*steam(?:powered|community).com\/?\S*?)>?(?: [^\r\n]+)*$/gm

export function setupSteamURLConverter(client: Discord.Client) {
    client.on('messageCreate', message => {
        if (message.author.id === client.user?.id) return;  // ignore my own messages
        const match = RGX_STEAM_URL.exec(message.content);
        if (match) {
            let steam_url = match[1];
            console.debug(`Steam link detected: ${steam_url}`);
            execute(message, steam_url);
        } else return;
    });
}

/**
 * Answers the supplied Discord message and provides an alternative URL to the one provided, which allows the user to open it directly within the steam client web browser.
 * @param {Discord.Message} message The Discord message that triggered this function
 * @param {string} url The URL which will be modified to be automatically opened by the steam client
 */
async function execute(message: Discord.Message, url: string) {
    const STEAM_PROT_PREFIX: string = "steam://openurl/"
    const steamed_url: string = `Open in Steam: ${STEAM_PROT_PREFIX}${url}`
    let replyOptions: Discord.ReplyMessageOptions = {
        content: steamed_url,
        allowedMentions: { repliedUser: false }   // don't ping the author
    };
    const msg = await message.reply(replyOptions)
        .catch(
            (error) => {
                console.error("Failed to send Steam URL.", error)
            });
    msg?.suppressEmbeds(true);  // avoid unnecessary clutter by suppressing embeds for the url included in sent message
}