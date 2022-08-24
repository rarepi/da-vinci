import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import Axios from 'axios';
import db from '../db';

const ClassModel = db['Class'];
const ServantModel = db['Servant'];

class Servant {
	id!: number;
	url?: string;
	name?: string;
	class?: string;
	deck?: string[];
	rarity?: number;
}

async function fetchServants() : Promise<Servant[]> {
	let servants = [];

	// all regex are written mostly dependend on gamepress' css class names
	const rgx_servant = /"servants-new-row"[\s\S]+?"tier-rating-numeric"/gu; // full servant row, no capture groups
    const rgx_servant_no = /"servant-no">(\d+)</u;	// [1] = id
	const rgx_servant_names = /"servant-list-title"[\s\S]+?"\/grandorder\/servant\/(.+?)">\s*?(.+?)\s*?</u;	// [1] = url name, [2] = full name
	const rgx_servant_class = /"servant-list-class"[\s\S]*?<small>(.+?)<\/small>/u;	// [1] = class
	const rgx_servant_deck = /"servant-deck".+?>(\w)<.+?>(\w)<.+?>(\w)<.+?>(\w)<.+?>(\w)</u; // [1] ... [5] = cards
	const rgx_servant_rarity = /"servant-rarity">\s*?(\d)\s*?</u; // [1] = rarity

    const html_full = (await Axios.get('https://gamepress.gg/grandorder/servants')).data;

	let html_servant:string | null;
	while ((html_servant = rgx_servant.exec(html_full)?.[0] ?? null) !== null) {
		let servant = new Servant();
		servant.id = Number(rgx_servant_no.exec(html_servant)?.[1]);
		let names = rgx_servant_names.exec(html_servant);	// 2 capture groups
		servant.url = names?.[1];
		servant.name = names?.[2];
		servant.class = rgx_servant_class.exec(html_servant)?.[1];
		servant.deck = rgx_servant_deck.exec(html_servant)?.slice(1);	// drops first element, thus copies all capture groups into servant.deck
		servant.rarity = Number(rgx_servant_rarity.exec(html_servant)?.[1]);

		servants.push(servant);
	}
	return servants;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('servants')
		.setDescription('Synchronizes the database with all FGO Servants from gamepress.gg'),
	async execute(interaction:Discord.CommandInteraction) {
        console.log("Executing /servants")
		let servants : Servant[] = await fetchServants();
		console.log(`Syncing ${servants.length} servants to database ...`)

		for(const servant of servants) {
			// create any new occuring Classes
			let [c, createdC] = servant.class ? await ClassModel.findOrCreate({
				where: {
					name: servant.class
				}
			}) : [undefined, false];
			if(createdC) console.log(`Created Class: ${c.name}`)

			// create any new occuring servants
			let [s, createdS] = await ServantModel.findOrCreate({
				where: {
					id: servant.id	// ignoring variants / duplicates
				},
				defaults: {
					id: servant.id,
					name: servant.name,
					url: servant.url,
					class: c?.id,
					card0: servant.deck?.[0],
					card1: servant.deck?.[1],
					card2: servant.deck?.[2],
					card3: servant.deck?.[3],
					card4: servant.deck?.[4],
					rarity: servant.rarity
				},
			});
			if(createdS) console.log(`Created Servant: [${s.id}] ${s.name}`);
			//else console.log(`${servant.name} has not been created!`)
		}
		console.log(`Finished syncing Servants database. (${await ServantModel.count()} servants)`)
	},
};