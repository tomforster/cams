var express = require('express');
var router = express.Router();

router.get('/robots.txt',function(req,res){
    console.info('Robot detected.');
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

module.exports = router;
