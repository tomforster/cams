var express = require('express');
var router = express.Router();

router.get('/robots.txt',function(req,res){
    console.info('Robot detected.');
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

router.get('/shouldrooniediaf', function(req,res){
    res.render('yes.pug');
});

module.exports = router;
