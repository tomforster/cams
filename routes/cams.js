/**
 * Created by Tom on 28/06/2016.
 */

'use strict';

const fs = require('fs');
const exec = require('child_process').exec;
const router = require('express').Router();
const IMAGE_CACHE_SIZE = 128;
const DEFAULT_PAGE_SIZE = 16;

const cameras = [
    { name: 'livingroom', directory: '/home/node/security/', recentImages: [], displayName: "Living Room Camera"},
    { name: 'kitchen', directory: '/home/node/security2/', recentImages: [], displayName: "Kitchen Camera"},
    { name: 'bedroom', directory: '/home/node/security3/', recentImages: [], displayName: "Bedroom Camera"}
];

module.exports = function(ws){

    updateImageCaches(ws);
    setInterval(function(){
        updateImageCaches(ws);
    }, 30000);

    router.get('/images/:camera/:tagId', function(req,res) {
        let cameraName = req.params["camera"];
        console.info(`Cat camera ${cameraName} image request.`);
        let camera = cameras.find(camera => camera.name === cameraName) || cameras[0];
        res.sendFile(camera.directory + req.params["tagId"]);
    });

    router.get('/:camera?/:numberImgs?', function(req,res) {
        let cameraName = req.params["camera"];
        let number = req.params["numberImgs"];
        number = number && number.match(/^\d+$/) ? Number(number) : DEFAULT_PAGE_SIZE;
        number = Math.min(number, IMAGE_CACHE_SIZE);
        number = Math.max(1, number);
        console.info(`Cat camera ${cameraName} page request.`);
        let camera = cameras.find(camera => camera.name === cameraName) || cameras[0];
        res.render('gallery.pug', {
            title: camera.displayName,
            images : camera.recentImages.slice(0,number).map(image => {
                const newImage = Object.assign({}, image);
                newImage.url = req.baseUrl + newImage.url;
                return newImage;
            })
        });
    });

    router.post('/snapshot/livingroom/',function(req,res){
        console.info('Snapshot livingroom camera');
        const camera = cameras.find(camera => camera.name === livingroom);
        if(!camera) throw "No livingroom camera found";
        exec('snapshot-cam-1.sh',
            function (error, stdout, stderr) {
                if (error !== null) {
                    console.error(error);
                } else {
                    console.info('stdout: ' + stdout);
                    console.info('stderr: ' + stderr);
                    setTimeout(function(){
                        updateImageCache(camera, ws);
                    }, 3000);
                }
            }
        );
    });

    router.ws('/socket', (ws, req) => console.info("Cat socket opened."));
    return router;
};

function updateImageCaches(ws){
    cameras.forEach(camera => updateImageCache(camera, ws));
}

function updateImageCache(camera, ws){
    let imageCache = camera.recentImages;
    let dir = camera.directory;
    let requestStr = `/images/${camera.name}/`;

    let newImageCache = fs.readdirSync(dir)
        .filter(file => file !== 'lastsnap.jpg' && file.charAt(0) !== '.')
        .filter(file => !(fs.statSync(dir + '/' + file).isDirectory() || getExtension(file) !== 'jpg' || file === 'lastsnap.jpg'))
        .sort((a, b) => fs.statSync(dir + b).mtime.getTime() - fs.statSync(dir + a).mtime.getTime())
        .map(file => { return {url: requestStr + file, time: getImageTime(file), date: getImageDate(file), type: getImageType(file)}; })
        .slice(0,IMAGE_CACHE_SIZE);

    //check for changes
    if(newImageCache.map(image => image.url).join() === imageCache.map(image => image.url).join()) return;

    console.info("New images found, image cache updated.");
    camera.recentImages = newImageCache;
    broadcastRefresh(ws);
}

function broadcastRefresh(ws){
    console.info("Sending refresh");
    ws.getWss('/socket').clients.forEach(function (client) {
        console.info("Refreshing "+client.toString());
        client.send('refresh', () => log.error);
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