import Axios from 'axios';
import { spawn } from 'child_process';
import Fs from 'fs';
import Path from 'path';
import Discord from "discord.js"

const PATH_TO_DL_DIR = Path.resolve("./", 'temp');
Fs.promises.mkdir(PATH_TO_DL_DIR, { recursive: true }).catch(console.error);

async function requestFileSize (url: string): Promise<number> {
    let fileSize: number = 0;
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

async function downloadFile (url: string, fileName: string): Promise<string> {
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

    data.on('data', (chunk: string | any[]) => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`Received ${chunk.length} bytes of data.`);
    })

    data.pipe(writer);

    return await new Promise((resolve, reject) => {
        writer.on('finish', () => {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`Download of ${url} completed.\n`);
            resolve(path);
        })
        writer.on('error', reject)
    })
}

export async function execute(message: Discord.Message, url: string) {
    const result = (await Axios.get(`${url}.json`));

    // extract video and audio URLs
    let reddit_video: string, reddit_audio: string;
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

    // use reddit's video filename as output filename
    let filename:string = /(?<=^https?:\/\/v\.redd\.it\/)\w+(?=\/DASH_\d+\.mp4\S*$)/.exec(reddit_video)?.[0] ?? "";
    if(filename.length <= 0) {
        console.log(`Failed to determine output filename.`);
        return;
    }

    // check if file size exceeds discord limits
    const videoSize = await requestFileSize(reddit_video)
        .catch(error => console.error(`File size request for ${reddit_video} failed.`, error));
    const audioSize = await requestFileSize(reddit_audio)
        .catch(error => console.error(`File size request for ${reddit_audio} failed.`, error));
    let estimatedFileSize = 0;
    if(videoSize && audioSize)
        estimatedFileSize = (videoSize + audioSize)/(1024**2);
    if(estimatedFileSize > 8) {
        console.log(`Reddit Download skipped due to filesize of ${estimatedFileSize}MB. Discord allows uploads of up to 8MB for bots.`)
        return;
    }

    // download video
    let videoPath: string;
    if(videoSize && videoSize > 0) {
        videoPath = await downloadFile(reddit_video,`${filename}.mp4`)
            .catch(
                (error): string => {
                    console.error(`Failed to download ${reddit_video}`, error);
                    return "";
                });
    }
    // download audio
    let audioPath: string;
    if(audioSize && audioSize > 0) {
        audioPath = await downloadFile(reddit_audio,`${filename}.aac`)
            .catch(
                (error): string => {
                    console.error(`Failed to download ${reddit_audio}`, error);
                    return "";
                });
    }
    const outPath = `${PATH_TO_DL_DIR}\\${filename}_out.mp4`;

    let mux = new Promise<void>(function(success, nosuccess) {
        let pArgs = [`-n`]  // don't overwrite existing files
        if(videoPath) {
            pArgs.push(`-i`, videoPath);    // input file (video)
        }
        if(audioPath) {
            pArgs.push(`-i`, audioPath);    // input file (audio)
        }
        pArgs.push(`-c`, `copy`, `${outPath}`); // selects "copy" as encoder (just copies the input streams without encoding)
        const p = spawn('ffmpeg', pArgs);
        var pOut = "";
        var pErr = "";

        p.stdout.on('data', (data: any) => {
            let dataStr = data.toString('utf8');
            pOut += dataStr;
        });

        p.stdout.on('close', (data: any) => {
            console.log(pOut);
            console.log(`Muxing completed.`);
            success();
        });

        p.stderr.on('data', (data: any) => {
            console.error(data.toString('utf8'));
        });
        p.stderr.on('close', (data: any) => {
            //pyErr += data.toString('utf8').trim();
            //console.error("\x1b[42m%s\x1b[0m", pErr);
            //nosuccess(pErr);
        });
    });

    await mux.catch(error => console.error('Failed muxing.', error));;

    const attachment = new Discord.MessageAttachment(outPath, `${filename}.mp4`);
    await message.reply({files: [attachment], allowedMentions: {repliedUser: false}})
        .catch(error => console.error("Failed to upload video to Discord.", error));
}