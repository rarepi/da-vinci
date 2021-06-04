const axios = require('axios');
const Discord = require('discord.js');
const dialogues = [];

const parseDialogues = async () => {
    const rgx =  /title="NA">\s*<p>\s*(.+)<\/p>[\s\S]+?<span class="ogg_custom">.+<source src="(.+\.ogg)/gu;
    const html = (await axios.get('https://fategrandorder.fandom.com/wiki/Sub:Leonardo_Da_Vinci/Dialogue')).data;
    let match = rgx.exec(html);
    do {
        dialogues.push([match[1], match[2]]);
    } while((match = rgx.exec(html)) !== null);
}
parseDialogues();

module.exports = {
	name: 'rq',
	description: 'Posts a random FGO dialogue quote by Da Vinci.',
	execute(message, args) {
		let rnd = Math.floor(Math.random() * dialogues.length);
		message.channel.send(`${dialogues[rnd][0]}`, {
			files: [{
				attachment: `${dialogues[rnd][1]}`,
			  }]
		  });
	},
};