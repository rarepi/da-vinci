import Discord from 'discord.js';
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, SelectMenuBuilder } from '@discordjs/builders';
import Axios from 'axios';
import databaseModels, { sequelize, DatabaseRevision, Database } from '../db';

// TODO: find a way to properly use Sequelize's typings within typescript
const ClassModel = databaseModels.Class;
const ServantModel = databaseModels.Servant;
const BannerModel = databaseModels.Banner;

const DISCORD_API_LIMIT_EMBED_FIELDS = 25;	// https://discord.com/developers/docs/resources/channel#embed-object-embed-limits

const GAMEPRESS_URL_BANNERS = "https://gamepress.gg/grandorder/summon-banner-list";
const GAMEPRESS_RGX = {
    servants: /sjson_dir = "(\S+\.json\?version=(\d+))"/u,	// [1] full URL to file, [2] "version" of the file
    banners: /gjson_dir = "(\S+\.json\?version=(\d+))"/u,	// [1] full URL to file, [2] "version" of the file
}

/**
 * Helper class to temporarily store servant data
 */
class Servant {
    id!: number;
    url!: string;
    name!: string;
    class?: string;
    deck?: string[];
    rarity?: number;
}

/**
 * Helper class to temporarily store summoning banner data
 */
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

/**
 * Interface describing gamepress' JSON data structure for servant data
 */
interface ServantJson {
    nid: [{ value: number }],
    title: [{ value: string }],
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
    field_3rd_append_skill_enhanceme: [{ value: number }],
    field_3rd_ascension_cost: [{ value: number }],
    field_3rd_skill_enhancement_cost: [{ value: number }],
    field_4th_append_skill_enhanceme: [{ value: number }],
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
    field_5th_skill_enhancement_cost: [{ value: number }],
    field_6th_append_skill_enhanceme: [{ value: number }],
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
    field_9th_skill_enhancement_cost: [{ value: number }],
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
    field_class: [{ tid: [{ value: 116 }], name: [{ value: string }] }],
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
    field_2nd_ascension_cost: [{ value: number }],
    field_2nd_skill_enhancement_cost: [{ value: number }],
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
    field_4th_skill_enhancement_cost: [{ value: number }],
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
    field_5th_append_skill_enhanceme: [{ value: number }],
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
    field_6th_skill_enhancement_cost: [{ value: number }],
    field_7th_append_skill_enhanceme: [{ value: number }],
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
    field_7th_skill_enhancement_cost: [{ value: number }],
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
    field_8th_append_skill_enhanceme: [{ value: number }],
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
    field_8th_skill_enhancement_cost: [{ value: number }],
    field_9th_append_skill_enhanceme: [{ value: number }],
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
    field_id: [{ value: number }],
    field_max_ascension_cost: [{ value: number }],
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

/**
 * Interface describing gamepress' JSON data structure for summoning banner data
 */
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

/**
 * Extracts currently available servant data from gamepress
 * @returns {Promise<Servant[]>}
 */
async function fetchServants(): Promise<[Servant[], number | undefined]> {
    let servants: Servant[] = [];

    const html_full = (await Axios.get(GAMEPRESS_URL_BANNERS)).data;
    const match = GAMEPRESS_RGX.servants.exec(html_full);
    if (!match) {
        console.error("Servant data file url not found.");
        return [servants, undefined];
    }
    const json_url: string = match[1];
    const json_version: number = Number(match[2]);

    const json_file = (await Axios.get(json_url)).data as ServantJson[];
    for (const s of json_file) {
        let servant = new Servant();
        servant.id = s.nid[0].value;
        servant.url = s.path[0].alias;
        servant.name = s.title[0].value;
        servant.class = s.field_class[0]?.name[0]?.value;
        //servant.deck = //not provided by json file, so the field 'deck' remains unused until I see a purpose for it
        servant.rarity = s.field_star[0]?.name[0]?.value;

        servants.push(servant);
    }

    return [servants, json_version];
}

/**
 * Extracts currently available summoning banner data from gamepress
 * @returns {Promise<Banner[]>}
 */
async function fetchBanners(): Promise<[Banner[], number | undefined]> {
    let banners: Banner[] = [];

    const html_full = (await Axios.get(GAMEPRESS_URL_BANNERS)).data;
    const match = GAMEPRESS_RGX.banners.exec(html_full)
    if (!match) {
        console.error(`Banner data file url not found.`);
        return [banners, undefined];
    }
    const json_url: string = match[1];
    const json_version: number = Number(match[2]);

    const json_file = (await Axios.get(json_url)).data as BannerJson[];
    for (const b of json_file) {
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

        for (const servant_entry of b.field_servant_profile_future_ban) {
            const servant_id = servant_entry.field_banner_servant[0]?.target_id;
            if (servant_id)
                banner.servants.add(servant_id);
        }

        banners.push(banner);
    }
    return [banners, json_version];
}

/**
 * Creates Discord embeds from Banner data according to Discord's API's size limitations.
 * Besides the amount of banners and thus fields generated, the provided parameters themselves are expected to be within Discord's API's Embed Limits described at: https://discord.com/developers/docs/resources/channel#embed-object-embed-limits
   * @param {(typeof BannerModel)[]} banners An array of summoning banners fetched from database
   * @param {string} [title] Title of the embed, displayed on the first embed only (up to 256 characters)
   * @param {string} [url] URL for the embed title, displayed on the first embed only
   * @param {string} [footer] Footer of the embed, displayed on the first embed only (up to 2048 characters)
   * @returns {EmbedBuilder[]} Embeds describing the summoning banners
 */
function bannersToEmbeds(banners: (typeof BannerModel)[], title?: string, url?: string, footer?: string): EmbedBuilder[] {
    const FIELDS_PER_BANNER = 4;	// including spacer
    const BANNERS_PER_EMBED = Math.floor(DISCORD_API_LIMIT_EMBED_FIELDS / FIELDS_PER_BANNER);
    let embeds: EmbedBuilder[] = [];

    let embed = new EmbedBuilder()
        .setTitle(title ?? null)
        .setURL(url ?? null)
        .setFooter(footer ? { text: footer } : null);

    for (let i = 0; i < banners.length; i++) {
        if (i > 0 && i % BANNERS_PER_EMBED === 0) {
            embeds.push(embed);
            embed = new EmbedBuilder();	// no title or url on follow ups
        }

        const b = banners[i];
        embed.addFields(
            { name: 'Summoning Banner', value: b.name },
            { name: ':flag_de: Start Date', value: (b.na_start_date as Date).toLocaleString('de-DE', { timeZone: "Europe/Berlin" }), inline: true },
            { name: ':flag_de: End Date', value: (b.na_end_date as Date).toLocaleString('de-DE', { timeZone: "Europe/Berlin" }), inline: true }
        );
        // add spacer if there are further items
        if (i < banners.length - 1) {
            embed.addFields({ name: '\u200B', value: '\u200B' })
        }
    }
    embeds.push(embed);
    return embeds;
}

/**
 * Fetches all currently on NA servers active summoning banners and provides the data as an Discord embed.
   * @returns {Promise<EmbedBuilder[]>} Embeds describing the currently active summoning banners
 */
async function execBannerCurrent(): Promise<EmbedBuilder[]> {
    let currentBanners: (typeof BannerModel)[] = await BannerModel.findCurrent();

    let embeds = bannersToEmbeds(
        currentBanners,
        'Currently active summoning banners:',
        GAMEPRESS_URL_BANNERS
    );
    return embeds;
}

/**
 * Fetches all on NA servers upcoming summoning banners and provides the data as an Discord embed. If needed, NA dates are predicated based on JP dates.
   * @param {number} count Number of summoning banners to fetch
   * @returns {EmbedBuilder[]} Embeds describing the summoning banners
 */
async function execBannerNext(count: number): Promise<EmbedBuilder[]> {
    let nextBanners: (typeof BannerModel)[] = await BannerModel.findNext(count);

    // if the existing data for announced banners is insufficient, try to predict the next banners based on japanese dates
    let dayOffset: number | undefined = undefined;
    if (nextBanners.length < count) {
        [nextBanners, dayOffset] = await BannerModel.findNextPredicted(count);
    }

    let embeds = bannersToEmbeds(
        nextBanners,
        'Upcoming summoning banners:',
        GAMEPRESS_URL_BANNERS,
        dayOffset ? `🇯🇵 Prediction based on japanese dates and recent date difference of ${dayOffset} days.` : undefined
    );
    return embeds;
}

/**
 * Synchronizes the local database with gamepress' data on both servants and summoning banners
   * @returns {Promise<[number, number]>} the new number of servants and the new number of banners in the database
 */
async function execBannerRefresh(): Promise<[number, number]> {
    let servants: Servant[];
    let servantDataRevision: number | undefined;
    [servants, servantDataRevision] = await fetchServants();

    console.info(`Syncing ${servants.length} servants to database ...`);
    const resultS = await sequelize.transaction(async (t) => {
        for (const servant of servants) {
            // create any new occuring Classes
            let [c, createdC] = servant.class ? await ClassModel.findOrCreate({
                where: {
                    name: servant.class
                },
                transaction: t
            }) : [undefined, false];
            if (createdC)
                console.info(`Created Class: ${c.name}`);

            // create any new occuring servants
            let [s, createdS] = await ServantModel.upsert({
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
            }, {
                //logging: console.debug,
                transaction: t
            });
            if (createdS) console.info(`Created Servant: [${s.id}] ${s.name}`);
            //else console.info(`${servant.name} has not been created!`)
        }
    });
    let scount = await ServantModel.count();
    console.info(`Finished syncing Servants database. (${scount} servants)`)

    let banners: Banner[];
    let bannerDataRevision: number | undefined;
    [banners, bannerDataRevision] = await fetchBanners();

    console.info(`Syncing ${banners.length} banners to database ...`)
    const resultB = await sequelize.transaction(async (t) => {
        for (const banner of banners) {
            // create any new occuring banners
            let [b, createdB] = await BannerModel.upsert({
                id: banner.id,
                name: banner.name,
                img: banner.img,
                guaranteed: banner.guaranteed,
                jp_start_date: banner.jp_start_date,
                jp_end_date: banner.jp_end_date,
                na_start_date: banner.na_start_date,
                na_end_date: banner.na_end_date,
                na_available: banner.na_available
            }, {
                //logging: console.debug,
                transaction: t,
            });
            for (const sid of banner.servants) {
                let servant = await ServantModel.findByPk(sid, { transaction: t });
                if (!(await b.hasServant(servant, { transaction: t }))) {	// check if servant is already on its list
                    await b.addServant(servant, { transaction: t });
                    console.info(`Added Servant [${servant.id}] ${servant.name} to Banner [${b.id}] ${b.name}.`);
                }
            }
            if (createdB) console.info(`Created Banner: [${b.id}] ${b.name}`);
            //else console.info(`${servant.name} has not been created!`)
        }
    });
    let bcount = await BannerModel.count();
    console.info(`Finished syncing Banners database. (${bcount} banners)`)

    Database.setDatabaseRevision(servantDataRevision, bannerDataRevision, new Date().getTime());
    return [scount, bcount];
}

async function databaseUpdateTask() {
    let databaseRevision: DatabaseRevision | undefined = Database.getDatabaseRevision();
    const updateThreshold = new Date().getTime() - Database.getUpdateInterval(); // current time in milliseconds minus schedule interval
    if (databaseRevision?.lastUpdate && databaseRevision.lastUpdate > updateThreshold) {
        console.debug("No database update necessary.");
    // } else {
    //     console.log("Looking for database updates...");
    //     const html_full = (await Axios.get(GAMEPRESS_URL_BANNERS)).data;
    //     const bmatch = GAMEPRESS_RGX.banners.exec(html_full);
    //     const smatch = GAMEPRESS_RGX.servants.exec(html_full);
    //     const json_banner_version: number = Number(bmatch?.[2]);
    //     const json_servant_version: number = Number(smatch?.[2]);
    //     console.debug(`Retrieved Banner Revision #${json_banner_version} and Servant Revision #${json_servant_version}.`);
    //     if (json_banner_version != databaseRevision?.Banner || json_servant_version != databaseRevision?.Servant) {
    //         console.info(`Database revisions [${databaseRevision?.Banner}, ${databaseRevision?.Servant}] differ from gamepress revisions [${json_banner_version}, ${json_servant_version}] \nStarting database update...`)
    //         await execBannerRefresh();
    //     } else {
    //         console.debug(`This equals local Banner Revision #${databaseRevision?.Banner} and local Servant Revision #${databaseRevision?.Servant}.`)
    //     }
    } else {    // revision ID of the json files seems to not be updated as regularily as I expected, so we just run the update everytime the schedule comes up
        console.info(`Starting database update...`);
        await execBannerRefresh();
    }
}

// run once on startup
databaseUpdateTask();
Database.runDatabaseScheduler(databaseUpdateTask);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fgo')
        .setDescription('Commands related to the mobile game Fate/Grand Order')
        .addSubcommandGroup(group => group
            .setName('event')
            .setDescription('Commands related to events.')
        )
        .addSubcommandGroup(group => group
            .setName('banner')
            .setDescription('Commands related to summoning banners')
            .addSubcommand(cmd => cmd
                .setName('current')
                .setDescription('Display currently ongoing summoning banners.')
            )
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
                .setName('refresh')
                .setDescription('Refreshes Da Vinci\'s summoning banner database. This takes a minute, don\'t spam.')
            )
            .addSubcommand(cmd => cmd
                .setName(`servant`)
                .setDescription(`Finds all upcoming banners the given servant will be featured on.`)
                .addStringOption(option => option
                    .setName(`name`)
                    .setDescription(`Name of the Servant`)
                    .setRequired(true)
                )
            )
        ),
    /**
     * Executes one of many (sub-)commands
     * @param {Discord.ChatInputCommandInteraction} interaction The Discord interaction that called this command 
     * @todo break this up into a more efficient data structure, similar to the way top level commands are already handled
     */
    async execute(interaction: Discord.ChatInputCommandInteraction) {
        const cmdGroup = interaction.options.getSubcommandGroup();
        const cmd = interaction.options.getSubcommand();
        if (cmdGroup === 'banner')
            if (cmd === 'next') {
                await interaction.deferReply({ ephemeral: true });

                let count = interaction.options.getInteger('count') ?? 1;

                let embeds = await execBannerNext(count);
                if (!embeds || embeds.length <= 0) {
                    await interaction.editReply('I couldn\'t find any upcoming summoning banners. So either FGO is officially dead or I messed up... :skull:');
                    return;
                }

                // finalize confirmation message
                let messageOptions: Discord.InteractionReplyOptions = {
                    embeds: embeds,
                    ephemeral: true
                };
                await interaction.editReply(messageOptions);
                return;
            } else if (cmd === 'current') {
                await interaction.deferReply({ ephemeral: true });

                let embeds = await execBannerCurrent();
                if (!embeds || embeds.length <= 0) {
                    await interaction.editReply('No limited time summoning banners are currently active.');
                    return;
                }

                // finalize confirmation message
                let messageOptions: Discord.InteractionReplyOptions = {
                    embeds: embeds,
                    ephemeral: true
                };
                await interaction.editReply(messageOptions);
                return;
            } else if (cmd === 'refresh') {
                //if(interaction.user.id == '')	//TODO maybe
                await interaction.deferReply({ ephemeral: true });

                let [scount, bcount] = await execBannerRefresh();

                // finalize confirmation message
                let messageOptions: Discord.InteractionReplyOptions = {
                    content: `Finished syncing gamepress data to database. (${scount} servants, ${bcount} banners)`,
                    ephemeral: true
                };
                await interaction.editReply(messageOptions);
                return;
            } else if (cmd === 'servant') {
                await interaction.deferReply({ ephemeral: true });

                let searchterm = interaction.options.getString('name');

                let searchResults: Servant[] = await ServantModel.findByName(searchterm);
                let slicedResults: boolean = false;
                if (searchResults.length <= 0) {
                    interaction.editReply(`'${searchterm}' yielded no results. Check for typos?`)
                    return;
                }
                if (searchResults.length > 25) {	// api limit
                    searchResults = searchResults.slice(0, 25);
                    slicedResults = true;
                    //interaction.editReply(`Search for '${searchterm}' returned too many results. Try to be more specific.`)
                    //return;
                }

                const servantSelection = new ActionRowBuilder<SelectMenuBuilder>()
                    .addComponents(
                        new SelectMenuBuilder()
                            .setCustomId('fgo_banner_servant_selection')
                            .setPlaceholder('Select a servant.')
                            .setMinValues(1)
                            .setMaxValues(1)
                            .addOptions(searchResults.map(s => ({ label: s.name, value: s.id.toString() })))
                    )
                let responseMsg = `Please select the servant you were looking for.`;
                if (slicedResults) responseMsg = responseMsg.concat(`\nThere have been too many results and only the first 25 are shown. If yours is missing, try to be more specific.`);
                await interaction.editReply({ content: responseMsg, components: [servantSelection] });

                const collector = interaction.channel!.createMessageComponentCollector({ componentType: Discord.ComponentType.SelectMenu, max: 1 });

                collector.on('collect', async collected => {
                    if (collected.user.id === interaction.user.id) {
                        let selectedServantId = collected.values[0];
                        let bannersFeaturingServant: Banner[] = await BannerModel.findByServant(selectedServantId, true);

                        let embeds = bannersToEmbeds(
                            bannersFeaturingServant,
                            `Upcoming Summoning Banners featuring ${(await ServantModel.findByPk(selectedServantId)).name} (${bannersFeaturingServant.length})`,
                            GAMEPRESS_URL_BANNERS,
                            `🇯🇵 Prediction based on japanese dates and the most recent date difference.`
                        )

                        let messageOptions: Discord.InteractionReplyOptions = {
                            content: null,
                            components: [],
                            embeds: embeds,
                            ephemeral: true
                        };
                        await interaction.editReply(messageOptions)
                    }
                });
            }
    },
};