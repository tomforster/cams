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

const feed = {name: 'feed', recentImages: [], displayName: "Feed"};

router.get('/images/:camera/:tagId', function(req,res) {
    let cameraName = req.params["camera"];
    let camera = cameras.find(camera => camera.name === cameraName) || feed;
    res.sendFile(camera.directory + req.params["tagId"]);
});

router.get('/:camera?', function(req,res) {
    let cameraName = req.params["camera"];
    let number = req.query.num;
    let hideSnapshots = req.query.hasOwnProperty("noss");
    console.log(hideSnapshots);
    number = number && number.match(/^\d+$/) ? Number(number) : DEFAULT_PAGE_SIZE;
    number = Math.min(number, IMAGE_CACHE_SIZE);
    number = Math.max(1, number);
    let camera = cameras.find(camera => camera.name === cameraName);

    res.render('gallery.pug', {
        title: camera && camera.displayName || feed.displayName,
        images: (camera && camera.recentImages || feed.recentImages).filter(image => !(hideSnapshots && image.type === 'snapshot')).slice(0, number)
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

    fs.readdirSync(dir)
        .filter(filename => filename !== 'lastsnap.jpg' && filename.charAt(0) !== '.' && !fs.statSync(dir + '/' + filename).isDirectory())
        .filter(filename => filenameMatcher.test(filename))
        .map(filename => {
            return {
                filename,
                path: `/cams/images/${camera.name}/${filename}`,
                time: getImageTime(filename),
                date: getImageDate(filename),
                type: getImageType(filename),
                timestamp: getTimestampForFilename(filename)
            }
        })
        .sort(timeStampSortFunction)
        .slice(0,IMAGE_CACHE_SIZE)
        .reverse()
        .forEach(file => {
            addAddFileIfNotInCache(file, camera, noBroadcast);
            addAddFileIfNotInCache(file, feed, noBroadcast);
        });
}

function addAddFileIfNotInCache(file, camera, noBroadcast)
{
    if (!camera.recentImages.find(recentFile => recentFile.path === file.path))
    {
        if(camera.recentImages.length === IMAGE_CACHE_SIZE)
        {
            const oldestImage = camera.recentImages[IMAGE_CACHE_SIZE - 1];
            if(file.timestamp > oldestImage.timestamp)
            {
                camera.recentImages.pop();
                camera.recentImages.push(file);
                if(!noBroadcast)
                {
                    console.info(`found new file ${file.filename} for camera ${camera.name}`);
                    broadcast(camera, file);
                }
            }
        }
        else
        {
            camera.recentImages.push(file);
        }
        camera.recentImages = camera.recentImages.sort(timeStampSortFunction);
    }
}

function broadcast(camera, file)
{
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify({camera: camera.name, file}));
        }
    });
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

function getTimestampForFilename(str)
{
    const dateTime = str.split("_").slice(0,2);
    dateTime[1] = dateTime[1].replace(/-/g, ':'); dateTime.join("T");
    return new Date(`${dateTime[0]}T${dateTime[1].replace(/-/g, ":")}`).getTime();
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

const timeStampSortFunction = (a, b) => b.timestamp - a.timestamp;