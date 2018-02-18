/**
 * Created by Tom on 28/06/2016.
 */

'use strict';

const fs = require('fs');
const exec = require('child_process').exec;
const router = require('express').Router();
const IMAGE_CACHE_SIZE = 128;
const DEFAULT_PAGE_SIZE = 16;
const filenameMatcher = new RegExp(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(snapshot|best)\.jpg$/);
let wss;

module.exports = (ws) => {
    wss = ws;

    wss.on('connection', (ws, req) => {
        const url = req.url;
        console.info(`Client connected to websocket: ${url}`);

        ws.on('error', err => err.code !== "ECONNRESET" ? console.error(err) : console.info(`Client disconnected from websocket: ${url}`));
    });


    updateImageCaches(true);
    setInterval(() => updateImageCaches(), 5000);

    return router;
};

const cameras = [
    { name: 'livingroom', directory: '/home/node/security/', recentImages: [], displayName: "Living Room"},
    { name: 'kitchen', directory: '/home/node/security2/', recentImages: [], displayName: "Kitchen"},
    { name: 'bedroom', directory: '/home/node/security3/', recentImages: [], displayName: "Bedroom"}
];

router.get('/images/:camera/:tagId', function(req,res) {
    let cameraName = req.params["camera"];
    let camera = cameras.find(camera => camera.name === cameraName) || cameras[0];
    res.sendFile(camera.directory + req.params["tagId"]);
});

router.get('/:camera?/:numberImgs?', function(req,res) {
    let cameraName = req.params["camera"];
    let number = req.params["numberImgs"];
    number = number && number.match(/^\d+$/) ? Number(number) : DEFAULT_PAGE_SIZE;
    number = Math.min(number, IMAGE_CACHE_SIZE);
    number = Math.max(1, number);
    let camera = cameras.find(camera => camera.name === cameraName) || cameras[0];
    res.render('gallery.pug', {
        title: camera.displayName,
        images : camera.recentImages.slice(0,number).map(image => {
            const newImage = Object.assign({}, image);
            newImage.url = req.baseUrl + newImage.url;
            return newImage;
        }),
        baseUrl: `/cams/images/${camera.name}/`
    });
});

router.post('/snapshot/livingroom/',function(req,res){
    console.info('Snapshot livingroom camera');
    const camera = cameras.find(camera => camera.name === "livingroom");
    if(!camera) throw "No livingroom camera found";
    exec('snapshot-cam-1.sh',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.error(error);
            } else {
                console.info('stdout: ' + stdout);
                console.info('stderr: ' + stderr);
                setTimeout(function(){
                    updateImageCache(camera);
                }, 3000);
            }
        }
    );
});

function updateImageCaches(noBroadcast){
    cameras.forEach(camera => updateImageCache(camera, noBroadcast));
}

function updateImageCache(camera, noBroadcast){
    let dir = camera.directory;

    let latestFiles = fs.readdirSync(dir)
        .filter(file => file !== 'lastsnap.jpg' && file.charAt(0) !== '.' && !fs.statSync(dir + '/' + file).isDirectory())
        .filter(file => filenameMatcher.test(file))
        .sort((a, b) => fs.statSync(dir + a).mtime.getTime() - fs.statSync(dir + b).mtime.getTime())
        .slice(0,IMAGE_CACHE_SIZE);

    for(let i = 0; i < latestFiles.length; i++)
    {
        if(!addAddFileIfNotInCache(latestFiles[i], camera, noBroadcast)) return;
    }
}

function addAddFileIfNotInCache(file, camera, noBroadcast)
{
    const cache = camera.recentImages;

    if (!cache.find(recentFile => recentFile.file === file))
    {
        if(!noBroadcast) console.info(`found new file ${file} for camera ${camera.name}`);
        const fileData = {file, time: getImageTime(file), date: getImageDate(file), type: getImageType(file)};
        cache.unshift(fileData);
        if(cache.length > IMAGE_CACHE_SIZE) cache.pop();
        if(!noBroadcast) {
            wss.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({camera: camera.name, fileData}));
                }
            });
        }
        return true;
    }
    return false;
}

function getImageTime(str){
    let splitstr = str.split(/[-_]/);
    if(splitstr.length < 7) return "";
    splitstr = splitstr.slice(3,6);
    return splitstr.join(':');
}

function getImageDate(str){
    let splitstr = str.split(/[-_]/);
    if(splitstr.length < 7) return "";
    splitstr = splitstr.slice(0,3);
    return splitstr.join('/');
}

function getImageType(str){
    let matches = str.match(/best/);
    if(matches){
        return "best"
    }
    matches = str.match(/snapshot/);
    if(matches){
        return "snapshot"
    }
    return ""
}

function getExtension(filename) {
    return filename.split('.').pop();
}