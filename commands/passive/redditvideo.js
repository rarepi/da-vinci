const Axios = require('axios');
const Discord = require('discord.js');
const { spawn } = require('child_process');
const Fs = require('fs');
const Path = require('path');

const PATH_TO_DL_DIR = Path.resolve("./", 'temp');
Fs.promises.mkdir(PATH_TO_DL_DIR, { recursive: true }).catch(console.error);

async function requestFileSize (url) {
    let fileSize;
    const response = await Axios({
      url,
      method: 'HEAD'
    })
    .catch(error => {
        if(error.response.status == 403)
            fileSize = 0;
        else
            console.error("Media not found.", error);
    });

    if(response != null && response.headers != null && "content-length" in response.headers)
        fileSize = parseInt(response.headers['content-length'])
    return fileSize;
  }

async function downloadFile (url, fileName) {
    const path = Path.resolve(PATH_TO_DL_DIR, fileName)
    if (Fs.existsSync(path)) {
        //console.log(`File already exists: Skipping download of ${url}`);
        return path;
    }

    const writer = Fs.createWriteStream(path)
    const {data, headers} = await Axios({
      url,
      method: 'GET',
      responseType: 'stream',
    })

    data.on('data', (chunk) => {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`Received ${chunk.length} bytes of data.`);
    })

    data.pipe(writer);

    return await new Promise((resolve, reject) => {
        writer.on('finish', () => {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Download of ${url} completed.\n`);
            resolve(path);
        })
        writer.on('error', reject)
    })
  }

module.exports = {
    async execute(message, url) {
        const result = (await Axios.get(`${url}.json`));
        //console.log(JSON.stringify(result.data[0].data.children[0].data, null, 4))
        if(result.data[0].data.children[0].data.hasOwnProperty(`crosspost_parent_list`)
            && result.data[0].data.children[0].data.crosspost_parent_list[0].media.hasOwnProperty(`reddit_video`)) {
            reddit_video = result.data[0].data.children[0].data.crosspost_parent_list[0].media.reddit_video.fallback_url
                        .replace(/(?<=^https?:\/\/v\.redd\.it\/\w+\/DASH_\d+\.mp4)\S+$/g, '');
            reddit_audio = reddit_video.replace(/(?<=^https?:\/\/v\.redd\.it\/\w+\/DASH_)\d+(?=\.mp4(\S*)$)/g, "audio");
        } else if(result.data[0].data.children[0].data.media.hasOwnProperty(`reddit_video`)) {
            reddit_video = result.data[0].data.children[0].data.media.reddit_video.fallback_url
                            .replace(/(?<=^https?:\/\/v\.redd\.it\/\w+\/DASH_\d+\.mp4)\S+$/g, '');
            reddit_audio = reddit_video.replace(/(?<=^https?:\/\/v\.redd\.it\/\w+\/DASH_)\d+(?=\.mp4(\S*)$)/g, "audio");
        } else {
            return;
        }
        const filename = /(?<=^https?:\/\/v\.redd\.it\/)\w+(?=\/DASH_\d+\.mp4\S*$)/.exec(reddit_video);

        const videoSize = await requestFileSize(reddit_video)
            .catch(error => console.error(`File size request for ${reddit_video} failed.`, error));
        const audioSize = await requestFileSize(reddit_audio)
            .catch(error => console.error(`File size request for ${reddit_audio} failed.`, error));
        const estimatedFileSize = (videoSize + audioSize)/(1024**2)
        if(estimatedFileSize > 8) {
            console.log(`Reddit Download skipped due to filesize of ${estimatedFileSize}MB. Discord allows uploads of up to 8MB for bots.`)
            return;
        }

        var videoPath = null;
        var audioPath = null;
        if(videoSize > 0) {
            videoPath = await downloadFile(reddit_video,`${filename}.mp4`)
                .catch(error => console.error(`Failed to download ${reddit_video}`, error));
        }
        if(audioSize > 0) {
            audioPath = await downloadFile(reddit_audio,`${filename}.aac`)
                .catch(error => console.error(`Failed to download ${reddit_audio}`, error));
        }
        const outPath = `${PATH_TO_DL_DIR}\\${filename}_out.mp4`;

        let mux = new Promise(function(success, nosuccess) {
            let pArgs = [`-n`]
            if(videoPath) {
                pArgs.push(`-i`, videoPath);
            }
            if(audioPath) {
                pArgs.push(`-i`, audioPath);
            }
            pArgs.push(`-c`, `copy`, `${outPath}`);
            const p = spawn('ffmpeg', pArgs);
            var pOut = "";
            var pErr = "";

            p.stdout.on('data', (data) => {
                let dataStr = data.toString('utf8');
                pOut += dataStr;
            });

            p.stdout.on('close', (data) => {
                console.log(pOut);
                console.log(`Muxing completed.`);
                success();
            });

            p.stderr.on('data', (data) => {
                console.error(data.toString('utf8'));
            });
            p.stderr.on('close', (data) => {
                //pyErr += data.toString('utf8').trim();
                //console.error("\x1b[42m%s\x1b[0m", pErr);
                //nosuccess(pErr);
            });
        });

        await mux.catch(error => console.error('Failed muxing.', error));;

        const attachment = new Discord.MessageAttachment(outPath, filename);
        await message.reply(attachment)
            .catch(error => console.error("Failed to upload video to Discord.", error));
    },
}