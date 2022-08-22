import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import Axios from 'axios';

let dialogues: string[][] = [];

const parseDialogues = async () => {
    const rgx_stripped = /^([\s\S]*?)Dialogue Related Servants/gu
    const rgx =  /NA(?:<\/?[\s\S]+?>[\s]*(?:TL)?)+([\s\S]+?)(?:<\/[\s\S]+?>\s*?)[\s\S]+?<audio src="(https?:\S+?.ogg)/gu;
    const html = (await Axios.get('https://fategrandorder.fandom.com/wiki/Sub:Leonardo_Da_Vinci/Dialogue')).data;

    // strip the html of a lot of unneeded data
    let match_clean_html = rgx_stripped.exec(html);
    if(match_clean_html == null) {
        console.log("ERROR: rq failed to retrieve cleaned up html page!");
        return;
    }
    let html_short = match_clean_html[0]
    let match = rgx.exec(html_short);
    if(match == null) {
        console.log("Error: rq dialogue regex returned an empty result!");
        return;
    }
    while((match = rgx.exec(html_short)) !== null) {
        //console.log(`Found: [${match[1]} , ${match[2]}`);
        let quote:string = match[1].replaceAll(/(?:<br \/>)|(?:<p>)/g, ""); // replace white space tags inbetween the quote
        let audio_url:string = match[2];
        dialogues.push([quote, audio_url]);
    }
}
parseDialogues();   // fills dialogues array

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rq')
		.setDescription('Posts a random FGO dialogue quote by Da Vinci.'),
	async execute(interaction:Discord.CommandInteraction) {
        if(dialogues.length <= 0) {
            interaction.reply({ 
                content:"Sorry, I failed to retrieve the required dialogue data.",
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply();
        let rnd = Math.floor(Math.random() * dialogues.length);
        //console.log(dialogues[rnd][0]);
        //console.log(dialogues[rnd][1]);
        let messageOptions:Discord.InteractionReplyOptions = {
            content: `${dialogues[rnd][0]}`,
            files: [{
                attachment: `${dialogues[rnd][1]}`,
              }]
        };
        await interaction.editReply(messageOptions);
	},
};