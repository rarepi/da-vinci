import Discord from "discord.js"

export async function execute(message: Discord.Message, url: string) {
    const STEAM_PROT_PREFIX:string = "steam://openurl/"
    const steamed_url:string = `Open in Steam: ${STEAM_PROT_PREFIX}${url}`
    let replyOptions:Discord.ReplyMessageOptions = {
        content: steamed_url,
        allowedMentions: {repliedUser: false}   // don't ping the author
    };
    const msg = await message.reply(replyOptions)
        .catch(
            (error) => {
                console.error("Failed to send Steam URL.", error)
            });
    msg?.suppressEmbeds(true);
}