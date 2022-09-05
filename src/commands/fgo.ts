import Discord, { Interaction, MessageEmbed } from 'discord.js';
import { SlashCommandBuilder, EmbedBuilder } from '@discordjs/builders';
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
	img?: string;
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

// returns Objects of every FGO servant extracted from gamepress data
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

// returns Objects of every FGO summoning banner extracted from gamepress data
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
		banner.img = b.field_banner[0]?.target_id;
		banner.guaranteed = b.field_is_guaranteed[0]?.value;
		// set fields to undefined if their respective json data is empty, else set as date
		banner.jp_start_date = b.field_jp_start_date[0]?.value ? new Date(b.field_jp_start_date[0]?.value + " 18:00:00 UTC+09:00") : undefined;
		banner.jp_end_date = b.field_jp_end_date[0]?.value ? new Date(b.field_jp_end_date[0]?.value + " 12:59:00 UTC+09:00") : undefined;
		banner.na_start_date = b.field_na_start_date[0]?.value ? new Date(b.field_na_start_date[0]?.value + " 01:00:00 PDT") : undefined;
		banner.na_end_date = b.field_na_end_date[0]?.value ? new Date(b.field_na_end_date[0]?.value + " 20:59:00 PDT") : undefined;
		banner.na_available = b.field_available_in_na[0]?.value;

		// // gamepress does not provide exact times at the moment, so this manually sets the usual banner start and end times if they're at 0.
		// if(banner.na_start_date.getHours() == 0) {
		// 	banner.na_start_date.setHours(1);
		// }
		// console.log(banner.na_start_date.getHours());
		// if(banner.na_end_date.getHours() == 0) {
		// 	banner.na_end_date.setHours(20);
		// 	banner.na_end_date.setMinutes(59);
		// }

		for(const servant_entry of b.field_servant_profile_future_ban) {
			const servant_id = servant_entry.field_banner_servant[0]?.target_id;
			banner.servants.add(servant_id);
		}

		banners.push(banner);
	}

	return banners;
}

async function execBannerCurrent() : Promise<MessageEmbed|null> {
	let currentBanners : (typeof BannerModel)[] = await BannerModel.findCurrent();
	if(currentBanners.length <= 0)
		return null;


	let embed = new EmbedBuilder()
	.setTitle('Currently active summoning banners:')
	.setURL('https://gamepress.gg/grandorder/summon-banner-list')
	//.setAuthor({ name: 'Test Author', iconURL: 'https://i.imgur.com/AfFp7pu.png', url: 'https://gamepress.gg/grandorder/summon-banner-list'})
	//.setDescription('Test Description')
	//.setThumbnail('https://i.imgur.com/AfFp7pu.png')
	// .addFields(
	// 	{ name: 'Regular field title', value: 'Some value here' },
	// 	{ name: '\u200B', value: '\u200B' },
	// 	{ name: 'Inline field title', value: 'Some value here', inline: true },
	// 	{ name: 'Inline field title', value: 'Some value here', inline: true },
	// )
	// .addFields({ name: 'Inline field title', value: 'Some value here', inline: true })
	//.setImage('https://i.imgur.com/AfFp7pu.png')
	//.setTimestamp()
	//.setFooter({ text: 'Some footer text here', iconURL: 'https://i.imgur.com/AfFp7pu.png' });
	

	for(let i=0; i < currentBanners.length;i++) {
		const b = currentBanners[i];
		embed.addFields( {
			name: 'Summoning Banner', value: b.name
		}, {
			name: ':flag_de: Start Date', value: (b.na_start_date as Date).toLocaleString('de-DE', {timeZone: "Europe/Berlin"}), inline: true
		}, {
			name: ':flag_de: End Date', value: (b.na_end_date as Date).toLocaleString('de-DE', {timeZone: "Europe/Berlin"}), inline: true
		})
		// add spacer if there are further items
		if(i < currentBanners.length-1) {
			embed.addFields({ name: '\u200B', value: '\u200B' })
		}
	}

	// TODO fix this workaround?
	let e : MessageEmbed = new MessageEmbed(embed.toJSON());
	return e;
}

async function execBannerNext(count:number) : Promise<MessageEmbed|null> {
	let predicted = false;
	let nextBanners : (typeof BannerModel)[] = await BannerModel.findNext(count);
	// if the existing data for announced banners is insufficient, try to predict the next banners based on japanese dates
	let dayOffset = 0;
	if(nextBanners.length < count) {
		[nextBanners, dayOffset] = await BannerModel.findNextPredicted(count);
		predicted = true;
	}

	if(nextBanners.length <= 0)
		return null;

	let embed = new EmbedBuilder()
	.setTitle('Upcoming summoning banners:')
	.setURL('https://gamepress.gg/grandorder/summon-banner-list')	

	for(let i=0; i < nextBanners.length;i++) {
		const b = nextBanners[i];

		let date_start : string;
		let date_end : string;
		if(b.na_start_date && b.na_end_date) {
			date_start = (b.na_start_date as Date).toLocaleString('de-DE', {timeZone: "Europe/Berlin"});
			date_end = (b.na_end_date as Date).toLocaleString('de-DE', {timeZone: "Europe/Berlin"});
		} else {
			let startTemp = b.jp_start_date as Date;
			startTemp.setDate(startTemp.getDate()+dayOffset);	// add day offset JP -> NA
			startTemp.setFullYear(startTemp.getFullYear()+2);	// add 2 year difference JP -> NA
			date_start = startTemp.toLocaleString('de-DE', {timeZone: "Europe/Berlin"});

			let endTemp = b.jp_end_date as Date;
			endTemp.setDate(endTemp.getDate() + dayOffset);	// add day offset JP -> NA
			endTemp.setFullYear(endTemp.getFullYear() + 2);	// add 2 year difference JP -> NA
			date_end = endTemp.toLocaleString('de-DE', {timeZone: "Europe/Berlin"});
		}

		embed.addFields( {
			name: 'Summoning Banner', value: b.name
		}, {
			name: ':flag_de: Start Date', value: date_start ?? '?', inline: true
		}, {
			name: ':flag_de: End Date', value: date_end ?? '?', inline: true
		})
		// add spacer if there are further items
		if(i < nextBanners.length-1) {
			embed.addFields({ name: '\u200B', value: '\u200B' })
		}
	}

	if(predicted)
		embed.setFooter({ text: `🇯🇵 Prediction based on japanese dates and recent date difference of ${dayOffset} days.` })

	// TODO fix this workaround?
	let e : MessageEmbed = new MessageEmbed(embed.toJSON());
	return e;
}

// returns the new number of servants and the new number of banners in the database
async function execBannerRefresh() : Promise<[number, number]> {
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
	let scount = await ServantModel.count();
	console.log(`Finished syncing Servants database. (${scount} servants)`)

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
				img: banner.img,
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
	let bcount = await BannerModel.count();
	console.log(`Finished syncing Banners database. (${bcount} banners)`)

	return [scount, bcount];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('fgo')
		.setDescription('Commands concerning the mobile game Fate/Grand Order')
		.addSubcommandGroup(group => group
			.setName('event')
			.setDescription('Commands concerning events.')
		)
		.addSubcommandGroup(group => group
			.setName('banner')
			.setDescription('Commands concerning summoning banners')
			.addSubcommand(cmd => cmd
				.setName('next')
				.setDescription('Display the next upcoming summoning banners.')
				.addIntegerOption(option => option
					.setName('count')
					.setDescription('The amount of summoning banners to look ahead')
					.setMinValue(1)
					.setMaxValue(6)
					.setRequired(false)
					)
			)
			.addSubcommand(cmd => cmd
				.setName('current')
				.setDescription('Display currently ongoing summoning banners.')
			)
			.addSubcommand(cmd => cmd
				.setName('refresh')
				.setDescription('Refreshes Da Vinci\'s summoning banner database. This takes a minute, don\'t spam!')
			)
		),
	async execute(interaction:Discord.CommandInteraction) {
		const cmdGroup = interaction.options.getSubcommandGroup();
		const cmd = interaction.options.getSubcommand();
		if(cmdGroup == 'banner')
			if(cmd == 'next') {
				await interaction.deferReply({ephemeral: true});

				let count = interaction.options.getInteger('count') ?? 1;

				let embed = await execBannerNext(count);
				if(!embed) {
					await interaction.editReply('I couldn\'t find any upcoming summoning banners. So either FGO is officially dead or I messed up... :skull:');
					return;
				}

				// finalize confirmation message
				let messageOptions:Discord.InteractionReplyOptions = {
					embeds: [embed],
					ephemeral: true
				};
				await interaction.editReply(messageOptions);
				return;
			} else if(cmd == 'current') {
				await interaction.deferReply({ephemeral: true});

				let embed = await execBannerCurrent();
				if(!embed) {
					await interaction.editReply('No limited time Summoning Banners are currently active.');
					return;
				}

				// finalize confirmation message
				let messageOptions:Discord.InteractionReplyOptions = {
					embeds: [embed],
					ephemeral: true
				};
				await interaction.editReply(messageOptions);
				return;
			} else if(cmd == 'refresh') {
				//if(interaction.user.id == '')	//TODO maybe
				await interaction.deferReply({ephemeral: true});
		
				let [scount, bcount] = await execBannerRefresh();

				// finalize confirmation message
				let messageOptions:Discord.InteractionReplyOptions = {
					content: `Finished syncing gamepress data to database. (${scount} servants, ${bcount} banners)`,
					ephemeral: true
				};
				await interaction.editReply(messageOptions);
				return;
			}



	},
};