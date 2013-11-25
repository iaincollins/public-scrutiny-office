var express = require('express');
var partials = require('express-partials');
var ejs = require('ejs');

// Oh yeah, php.js. I went there.
var phpjs = require('phpjs');

var app = express();

app.use(express.static(__dirname + '/public'))
app.use(partials());

app.set('title', 'Public Scrutiny Office');
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.engine('ejs', ejs.__express);

partials.register('.ejs', ejs);

app.get('/', function(req, res, next) {
    // @fixme Obviously these queries should happen synchronously!
    var bills = require(__dirname + '/lib/bills');
    var b = new bills();
    b.billsBeforeParliament(function(billsBeforeParliament) {
        var events = require(__dirname + '/lib/events');
        var e = new events();
        e.upcomingEvents(function(upcomingEvents) {
            res.render('index', { bills: billsBeforeParliament, events: upcomingEvents });
        });
    });
});

app.get('/about', function(req, res, next) {
    res.render('about', {});
});

app.get('/members', function(req, res, next) {
    res.render('members', {});
});

app.get('/bill', function(req, res, next) {
    res.redirect('/');
});

app.get('/bill/:name', function(req, res, next) {
    // NB: Bill name in req.params.name
    res.render('bill', {});
});

// Handle 404 Errors
app.use(function(req, res, next) {
    res.status(404).render('page-not-found', {
        title: "Page not found"
    });
});

app.listen(3000);