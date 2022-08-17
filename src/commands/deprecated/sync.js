const Discord = require('discord.js');
const Axios = require('axios');
const Fs = require('fs');
const Path = require('path');
const db = require('../models.js');

const URL_FANDOM = "https://fategrandorder.fandom.com";
const sClasses = new Map([
    ['847137403272953856', "Shielder"],
    ['847137429135556648', "Saber"],
    ['847137454825799700', "Archer"],
    ['847137472130973716', "Lancer"],
    ['847137861480087622', "Rider"],
    ['847137884292644904', "Caster"],
    ['847137904937664512', "Assassin"],
    ['847137927150698496', "Berserker"],
    ['847137949542907914', "Ruler"],
    ['847137980489007112', "Avenger"],
    ['847138003741704232', "Moon Cancer"],
    ['847138039460659200', "Alter Ego"],
    ['847138056510767104', "Foreigner"],
    ['847138071531094066', "Beast"]
]);
const PATH_TO_SPRITES = Path.resolve("./", 'images', 'sprites');
Fs.promises.mkdir(PATH_TO_SPRITES, { recursive: true }).catch(console.error);


const fetchServantList = async (servantClassName) => {
    let servants = [];
    // tried to solve this in a single regex but I failed.
    const tableRgx = /<table class="wikitable"[\s\S]+?<\/table>[\s\S]+?Basics/gu;    // removes all html but the table listing the servants
    const servantsRgx =  /<td><a href="(\/wiki\/.+?)".+?">(.+?)<\/a>/gu;    // puts every servant's name and url into a group
    const html = await Axios.get(`${URL_FANDOM}/wiki/${servantClassName}`)
        .catch(error => console.error('Failed to fetch class html: ', error));
    let table = tableRgx.exec(html.data)[0];
    let servant = servantsRgx.exec(table);
    do {
        servants.push([servant[1], servant[2]]);        // url, name
    } while((servant = servantsRgx.exec(table)) !== null);
    return servants;
}

async function downloadImage (url, fileName) {
    const path = Path.resolve(PATH_TO_SPRITES, fileName)
    if (Fs.existsSync(path)) {
        //console.log(`File already exists: Skipping download of ${url}`);
        return path;
    }

    const writer = Fs.createWriteStream(path)
    console.log(`Downloading... (${url})`);
    const {data, headers} = await Axios({
      url,
      method: 'GET',
      responseType: 'stream',
    })

    data.on('data', (chunk) => {
        console.log(chunk)
    })

    data.pipe(writer);

    return await new Promise((resolve, reject) => {
        writer.on('finish', () => {
            console.log(`Download completed.`);
            resolve(path);
        })
        writer.on('error', reject)
    })
  }

const fetchExpressionSheets = async (servantWikiUrl) => {
    let sheets = [];
    // tried to solve this in a single regex but I failed.
    const sheetsRgx = /<div class=".+?" title="Expression Sheets">([\S\s]+?)<span>Add a photo to this gallery<\/span>/gu;    // removes all html but the expression sheets section
    const sheetRgx =  /data-src="(.+?\.png.*?")[\S\s]+?lightbox-caption[\S\s]+?>(.*?)<\/div>/gu;    // captures sheet image url (1) and description (2)
    const fullHtml = await Axios.get(`${URL_FANDOM}${servantWikiUrl}`)
        .catch(error => console.error('Failed to fetch servant html: ', error));
    let sheetsHtml = sheetsRgx.exec(fullHtml.data)[0];
    let sheet = sheetRgx.exec(sheetsHtml);
    do {
        const filePath = await downloadImage(sheet[1].replace(/\/scale-to-width-down\/[0-9]+/g, '').replace('https', 'http'), sheet[1].match(/[^\/]+\.png/g)[0])
            .catch(error => console.error(`Failed to download sheet image from ${sheet[1]}\n`, error));
        sheets.push([filePath, sheet[2].replace(/<[\S\s]+?>/g, '')]);        // local file, description (regex removes html tags)
    } while((sheet = sheetRgx.exec(sheetsHtml)) !== null);
    return sheets;
}

module.exports = {
    name: `sync`,
    description: `Syncs Servant Database with the fandom wiki. Don't spam.`,
    async execute(message, args) {
        console.log(`Sync initiated.`);
        const ServantClasses = db["classes"];
        const Servants = db["servants"];
        const Sheets = db["sheets"];

        try {
            sClasses.forEach(async (value, key) => {
                const sClass = await ServantClasses.findCreateFind({
                    where: {
                        iconId: key,
                        name: value
                    }
                });
            })
        } catch (error) {
            console.error("Failed writing classes to db: ", error);
        }

        const servantClassesList = await ServantClasses.findAll();

        console.log(`Fetching servants.`);
        let servantList = new Map();
        try {
            for (let i = 0; i < servantClassesList.length; i++) {
                servantList.set(servantClassesList[i].iconId, await fetchServantList(servantClassesList[i].name));
            }
            //console.log(servantList);
        } catch (error) {
            console.error("Failed to fetch servant list!", error);
        }

        console.log(`Syncing servants and sheets.`);
        for(const [_class, _servants] of servantList) {
                for (let i = 0; i < _servants.length; i++) {
                    let servant;
                    try {
                        servant = await Servants.findOrCreate({
                            where: {
                                fandomURL: _servants[i][0]
                            },
                            defaults: {
                                name: _servants[i][1],
                                class: _class,
                            }
                        });
                    } catch (error) {
                        console.error(`Failed syncing servant data to DB: `, error);
                        continue;
                    }

                    const sheets = await fetchExpressionSheets(_servants[i][0])
                        .catch(error => console.error(`Failed to download sheet images for ${_servants[i][0]}\n`, error));
                    for(const _sheet of sheets) {
                        const [sheet, created] = await Sheets.findOrCreate({
                            where: {
                                path: _sheet[0],
                            },
                            defaults: {
                                description: _sheet[1],
                                servant: servant[0].id,
                            }
                        }).catch(error => console.error(`Failed syncing sheet data to DB: `, error));;
                    }
                }
            }
        console.log(`Sync has finished.`);
    },
};