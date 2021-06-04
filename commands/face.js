const Discord = require('discord.js');
const Axios = require('axios');
const Fs = require('fs');
const Path = require('path');
const {Op} = require('sequelize');
const db = require('../models.js');
const { spawn } = require('child_process');

const MAX_PROCESS_COUNT = 5;
const PATH_TO_SPRITES = Path.resolve("./", 'images', 'sprites');
const PATH_TEMP_DATA = Path.resolve("./", 'temp', 'data');
Fs.promises.mkdir(PATH_TO_SPRITES, { recursive: true }).catch(console.error);

module.exports = {
    name: `face`,
    description: `Face recognition.`,
    async execute(message, args) {
        const Sheets = db["sheets"];
        //db.sequelize.options.logging = console.log;
        sheets = await Sheets.findAll({
            where: {
                certainty: {
                    [Op.lt]: 100.0	// IMPORTANT Skips any records that have been corrected manually (or actually generated with a 100% certainty).
                }
            }
        }, {
            attributes: ['path']
        });

        sheets_records = sheets.map(sheet => sheet.dataValues)

        console.log(`Working ${sheets_records.length} records.`)

        var file_data = [];
        const data_files = [];
        const file_count = sheets_records.length;
        const files_per_process = Math.floor(file_count / MAX_PROCESS_COUNT)
        for(var i = 0; i < MAX_PROCESS_COUNT; i++) {
            for (var j = 0; (j < files_per_process || i === MAX_PROCESS_COUNT-1) && j+i*files_per_process < file_count; j++) {
                //console.log(j+i*files_per_process+1);
                const dataset = {
                    path: sheets_records[j+i*files_per_process].path,
                    bodyWidth: null,
                    bodyHeight: null,
                    headX: null,
                    headY: null,
                    eWidth: null,
                    eHeight: null,
                    dialogOffsetX: null,
                    dialogOffsetY: null,
                    specialFormat: null,
                    approved: 0
                }
                file_data.push(dataset);
            }
            let data_file = Path.resolve(PATH_TEMP_DATA, `data${i}.json`);
            Fs.writeFile(data_file, JSON.stringify(file_data, null, 2), { flag: 'w' }, (err) => {
                if (err) throw err;
            });
            data_files.push(data_file);
            file_data = [];
        }

        const results = []
        let process_count = 0;
        for(let i = 0; i < data_files.length; i++) {
            let data_file = data_files[i];
            process_count++;
            const pyprog = spawn('python', ['./python/findFaces.py', data_file]);
            console.log(`Worker ${i} started.`)
            pyprog.stdout.on('data', (data) => {
                //console.log(data.toString('utf8'));
            });

            pyprog.stdout.on('close', async (exit_code) => {
                console.log(`Process ${i} finished.`);
                let data_file = Path.resolve(PATH_TEMP_DATA, `data${i}.json`);
                const jsonStr = await Fs.promises.readFile(data_file);
                results.push(JSON.parse(jsonStr));
                process_count--;
                if(process_count === 0) {
                    let result = [];
                    for(const r of results) {
                        result = result.concat(r)
                    }
                    console.log(`Finished ${result.length} expression sheet calibrations.`);
                    console.log(`Writing to database...`);
                    for(const r of result) {
                        await Sheets.update({
                            bodyWidth: r.bodyWidth,
                            bodyHeight: r.bodyHeight,
                            headX: r.headX,
                            headY: r.headY,
                            eWidth: r.eWidth,
                            eHeight: r.eHeight,
                            dialogOffsetX: r.dialogOffsetX,
                            dialogOffsetY: r.dialogOffsetY,
                            specialFormat: r.specialFormat,
                            certainty: r.certainty
                        }, {
                            where: {
                                path: r.path
                            }
                        })
                    }
                    //db.sequelize.options.logging = false;
                    //cleanup temp data
                    await Fs.promises.readdir(PATH_TEMP_DATA)
                        .then(files => {
                            for (const file of files) {
                                Fs.promises.unlink(Path.join(PATH_TEMP_DATA, file))
                                    .then(console.log(`DEBUG: Removed ${file}.`))
                            }
                          });
                    console.log(`Face calibrations have finished.`);
                }
            });
            pyprog.stderr.on('data', (data) => {
                //console.error(data.toString('utf8'));
            });
        }
    },
};