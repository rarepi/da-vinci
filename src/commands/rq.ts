let dialogues: string[][];
import Discord from 'discord.js';
import Axios from 'axios';

const parseDialogues = async () => {
    const rgx =  /<span class="ogg_custom">.+<source src="(.+\.ogg)/gu;
    const html = (await Axios.get('https://fategrandorder.fandom.com/wiki/Sub:Leonardo_Da_Vinci/Dialogue')).data;
    let match = rgx.exec(html);
    while((match = rgx.exec(html)) !== null) {
        dialogues.push([match[1], match[2]]);
    }
}
parseDialogues();

module.exports = {
    name: 'rq',
    description: 'Posts a random FGO dialogue quote by Da Vinci.',
    execute(message: Discord.Message, args: string[]) {
        let rnd = Math.floor(Math.random() * dialogues.length);
        let messageOptions:Discord.MessageOptions = {
            content: `${dialogues[rnd][0]}`,
            files: [{
                attachment: `${dialogues[rnd][1]}`,
              }]
        };
        message.channel.send(messageOptions);
    },
};