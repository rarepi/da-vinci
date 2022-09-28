import Discord from "discord.js"

export async function sendChannelMessage(client: Discord.Client, channelId: string, ...message: string[]) {
    await client.channels.fetch(channelId)
        .then(channel => {
            if(channel?.isTextBased() && !channel.isDMBased()) {
                channel.send(message.join(' ')).catch((error:any) => console.error(`[${error.code}] ${error.message}`));
            }
        }).catch((error:any) => {
            if(error.code == 10003) {
                console.error(`Channel not found.`)
            } else console.error(`[${error.code}] ${error.message}`)
        });
}

export async function sendDirectMessage(client: Discord.Client, userId: string, ...message: string[]) {
    await client.users.createDM(userId)
        .then(dm => {
            dm.send(message.join(' ')).catch((error:any) => console.error(`[${error.code}] ${error.message}`));
        }).catch((error:any) => {
            if(error.code == 50033) {
                console.error(`Invalid user.`)
            } else console.error(`[${error.code}] ${error.message}`)
        });
}