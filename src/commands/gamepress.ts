import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import Axios from 'axios';
import db from '../db';

const ClassModel = db['Class'];
const ServantModel = db['Servant'];
const BannerModel = db['Banner'];

class Servant {
	id!: number;
	url!: string;
	name!: string;
	class?: string;
	deck?: string[];
	rarity?: number;
}

class Banner {
	id!: number;
	name!: string;
	guaranteed?: boolean;
	jp_start_date?: Date;
	jp_end_date?: Date;
	na_start_date?: Date;
	na_end_date?: Date;
	na_available?: boolean;
	servants: Set<number> = new Set(); // Using Set to get rid of duplicates (we only track if a servant is on the banner, not how often)
}

interface ServantJson {
	nid: [{ value: number }],
	title: [{ value: string}],
	path: [{ alias: string, pid: number, langcode: string }],
	field_1st_append_skill_enhanceme: [{ value: number }],
	field_1st_ascension_cost: [{ value: number }],
	field_2nd_append_skill_enhanceme: [{ value: number }],
	field_2nd_append_skill_mats: [{ 
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
	}],
	field_2nd_ascension_materials: [{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
	}],
	field_3rd_append_skill_enhanceme: [ { value: number } ],
	field_3rd_ascension_cost: [ { value: number } ],
  	field_3rd_skill_enhancement_cost: [ { value: number } ],
	field_4th_append_skill_enhanceme: [ { value: number } ],
	field_4th_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_5th_skill_enhancement_cost: [ { value: number } ],
	field_6th_append_skill_enhanceme: [ { value: number } ],
	field_6th_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_8th_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_9th_skill_enhancement_cost: [ { value: number } ],
	field_9th_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_class: [ { tid: [{ value: 116 }], name: [{ value: string }] } ],
	field_max_ascension_materials: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_release_status: [{ tid: [{ value: number }], name: [{ value: string }] }],
	field_1st_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_1st_ascension_materials: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_1st_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_2nd_ascension_cost: [ { value: number } ],
	field_2nd_skill_enhancement_cost: [ { value: number } ],
	field_2nd_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_3rd_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_3rd_ascension_materials: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_3rd_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_4th_skill_enhancement_cost: [ { value: number } ],
	field_4th_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_5th_append_skill_enhanceme: [ { value: number } ],
	field_5th_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_5th_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_6th_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_6th_skill_enhancement_cost: [ { value: number } ],
	field_7th_append_skill_enhanceme: [ { value: number } ],
	field_7th_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_7th_skill_enhancement_cost: [ { value: number } ],
	field_7th_skill_enhancement_mate: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_8th_append_skill_enhanceme: [ { value: number } ],
	field_8th_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_8th_skill_enhancement_cost: [ { value: number } ],
	field_9th_append_skill_enhanceme: [ { value: number } ],
	field_9th_append_skill_mats: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_materials: [],
		field_number_of_materials: []
		}
	],
	field_append_skills: [
		{ target_id: number },
		{ target_id: number },
		{ target_id: number }
	],
	field_id: [ { value: number } ],
	field_max_ascension_cost: [ { value: number } ],
	field_servant_icon: [
		{
		target_id: string,
		alt: string,
		title: string,
		width: number,
		height: number
		}
	],
	field_servant_skills: [
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_servant_skill: [],
		field_skill_unlock: [],
		field_skill_upgrades: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_servant_skill: [],
		field_skill_unlock: [],
		field_skill_upgrades: []
		},
		{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_servant_skill: [],
		field_skill_unlock: [],
		field_skill_upgrades: []
		}
	],
	field_stage_1_image: [
		{
		target_id: string,
		alt: string,
		title: string,
		width: number,
		height: number
		}
	],
	field_stage_2_image: [
		{
		target_id: string,
		alt: string,
		title: string,
		width: number,
		height: number
		}
	],
	field_stage_3_image: [
		{
		target_id: string,
		alt: string,
		title: string,
		width: number,
		height: number
		}
	],
	field_stage_4_image: [
		{
		target_id: string,
		alt: string,
		title: string,
		width: number,
		height: number
		}
	],
	field_star: [{ tid: [{ value: number }], name: [{ value: number }] }]
}

interface BannerJson {
	title: [{ value: string }],
	field_available_in_na: [{ value: boolean }],
	field_banner: [{
		target_id: string,
		alt: string,
		title: string,
		width: number,
		height: number
	}],
	field_is_guaranteed: [{ value: boolean }],
	field_jp_end_date: [{ value: string }],
	field_jp_start_date: [{ value: string }],
	field_na_end_date: [{ value: string }],
	field_na_start_date: [{ value: string }],
	field_servant_profile_future_ban: [{
		id: [],
		uuid: [],
		revision_id: [],
		langcode: [],
		type: [],
		status: [],
		created: [],
		parent_id: [],
		parent_type: [],
		parent_field_name: [],
		behavior_settings: [],
		default_langcode: [],
		revision_default: [],
		revision_translation_affected: [],
		field_banner_reference: [],
		field_banner_servant: [{ target_id: number }]
	}],
	field_sim_number: [{ value: number }]
}  

async function fetchServants() : Promise<Servant[]> {
	let servants : Servant[] = [];

	// all regex are written mostly dependend on gamepress' css class names
	const rgx_servants = /sjson_dir = "(\S+\.json\S+)"/gu; // servant_json.json?version=###

    const html_full = (await Axios.get('https://gamepress.gg/grandorder/summon-banner-list')).data;
	let json_url:string | undefined = rgx_servants.exec(html_full)?.[1];
	if(!json_url) throw("ERROR: Servant data file url not found.")

	const json_file = (await Axios.get(json_url)).data as ServantJson[];
	for(const s of json_file) {
		let servant = new Servant();
		servant.id = s.nid[0].value;
		servant.url = s.path[0].alias;
		servant.name = s.title[0].value;
		servant.class = s.field_class[0]?.name[0]?.value;
		//servant.deck = //not provided by json file, so the field 'deck' remains unused until I see a purpose for it
		servant.rarity = s.field_star[0]?.name[0]?.value;

		servants.push(servant);
	}

	return servants;
}

async function fetchBanners() : Promise<Banner[]> {
	let banners : Banner[] = [];

	// all regex are written mostly dependend on gamepress' css class names
	const rgx_servants = /gjson_dir = "(\S+\.json\S+)"/gu; // servant_json.json?version=###

    const html_full = (await Axios.get('https://gamepress.gg/grandorder/summon-banner-list')).data;
	let json_url:string | undefined = rgx_servants.exec(html_full)?.[1];
	if(!json_url) throw("ERROR: Banner data file url not found.")

	const json_file = (await Axios.get(json_url)).data as BannerJson[];
	for(const b of json_file) {
		let banner = new Banner();
		banner.id = b.field_sim_number[0]?.value;
		banner.name = b.title[0].value;
		banner.guaranteed = b.field_is_guaranteed[0]?.value;
		banner.jp_start_date = new Date(b.field_jp_start_date[0]?.value);
		banner.jp_end_date = new Date(b.field_jp_end_date[0]?.value);
		banner.na_start_date = new Date(b.field_na_start_date[0]?.value);
		banner.na_end_date = new Date(b.field_na_end_date[0]?.value);
		banner.na_available = b.field_available_in_na[0]?.value;

		for(const servant_entry of b.field_servant_profile_future_ban) {
			const servant_id = servant_entry.field_banner_servant[0]?.target_id;
			banner.servants.add(servant_id);
		}

		banners.push(banner);
	}

	return banners;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gamepress')
		.setDescription('Synchronizes the local FGO database with data from gamepress.gg'),
	async execute(interaction:Discord.CommandInteraction) {
        console.log("Executing /gamepress")

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

		let banners : Banner[] = await fetchBanners();
		console.log(`Syncing ${banners.length} banners to database ...`)
		for(const banner of banners) {
			// create any new occuring banners
			let [b, createdB] = await BannerModel.findOrCreate({
				where: {
					id: banner.id
				},
				defaults: {
					id: banner.id,
					name: banner.name,
					guaranteed: banner.guaranteed,
					jp_start_date: banner.jp_start_date,
					jp_end_date: banner.jp_end_date,
					na_start_date: banner.na_start_date,
					na_end_date: banner.na_end_date,
					na_available: banner.na_available
				}
			});
			for(const sid of banner.servants) {
				if(createdB || !(await b.hasServant(await ServantModel.findByPk(sid))) )	// if the banner already existed, check if servant is already on its list
					await b.addServant(sid);
			}
			if(createdB) console.log(`Created Banner: [${b.id}] ${b.name}`);
			//else console.log(`${servant.name} has not been created!`)
		}
		console.log(`Finished syncing gamepress data to database. (${await ServantModel.count()} servants, ${await BannerModel.count()} banners)`)
	},
};