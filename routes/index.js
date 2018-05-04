var express = require('express');
var router = express.Router();

router.get('/robots.txt',function(req,res){
    console.info('Robot detected.');
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

router.get('/should*diaf', function(req,res){
    const name = req.path.substring(7, req.path.length - 4);
    res.render('yes.pug', {name});
});

module.exports = router;
