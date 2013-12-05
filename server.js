var express = require('express');
var partials = require('express-partials');
var ejs = require('ejs');

// Using PHPJS sparingly for string and date functions.
var phpjs = require('phpjs');

// Load app config
var config = require(__dirname + '/lib/config.json');

var app = express();

app.use(express.static(__dirname + '/public'))
app.use(partials());

app.set('title', 'Public Scrutiny Office');
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.engine('ejs', ejs.__express);

partials.register('.ejs', ejs);

app.get('/', function(req, res, next) {
    // @fixme Use promises instead of callbacks here
    var bills = require(__dirname + '/lib/bills');
    
    // Only fetch bills that (a) have text and (b) were updated recently
    // (Bills that have not bene updated recently must not have been in the
    // RSS the last time it was parsed so have been dropped or become law.)
    var yesterday = phpjs.date('Y-m-d', phpjs.strtotime('1 day ago'));
    var options = { hasHtml: true, lastUpdated: { $gte: yesterday } };

    bills.getBills(options, function(billsBeforeParliament) {
        var events = require(__dirname + '/lib/events');
        events.upcomingEvents(function(upcomingEvents) {
            res.render('index', { bills: billsBeforeParliament, events: upcomingEvents });
        });
    });
});

app.get('/about', function(req, res, next) {
    res.render('about', { title: "About the Public Scrutiny Office" });
});

app.get('/faq', function(req, res, next) {
    res.render('faq', { title: "Public Scrutiny Office FAQ" });
});

app.get('/members', function(req, res, next) {
    res.render('members', {});
});

app.get('/api/bills', function(req, res, next) {
    var bills = require(__dirname + '/lib/bills');
            
    // Only fetch bills that were updated recently.
    // (Bills that have not bene updated recently must not have been in the
    // RSS the last time it was parsed so have been dropped or become law.)
    var yesterday = phpjs.date('Y-m-d', phpjs.strtotime('1 day ago'));
    var options = { lastUpdated: { $gte: yesterday } };
    bills.getBills(options, function(billsBeforeParliament) {
        // Don't return the full text unless it's explicitly requested.
        if (!req.query.fullText || req.query.fullText != 'true') {
            billsBeforeParliament.forEach(function(bill, index) {
                billsBeforeParliament[index].html = undefined;
            });
        }
        billsBeforeParliament.forEach(function(bill, index) {
            billsBeforeParliament[index].fullTextUrl = "http://public-scrutiny-office.org/bills"+bill.path+"/text";
        });
        res.setHeader('Content-Type', 'application/json');
        res.render('api/bills', { bills: billsBeforeParliament, layout: null });
    });
});

app.get('/bills', function(req, res, next) {
    res.redirect('/');
});

app.get('/bills/:year/:name', function(req, res, next) {
    // @fixme Use promises instead of callbacks here
    var bills = require(__dirname + '/lib/bills');
    var path = '/'+req.params.year+'/'+req.params.name; 
    bills.getBillByPath(path, function(bill) {
        if (bill == undefined) {
            res.status(404).render('page-not-found', {
                title: "Page not found"
            });
        } else {
            res.render('bill', { bill: bill, title: bill.name+' Bill' });
        }
    });
});

app.get('/bills/:year/:name/text', function(req, res, next) {
    // @fixme Use promises instead of callbacks here
    var bills = require(__dirname + '/lib/bills'); 
    var path = '/'+req.params.year+'/'+req.params.name;
    bills.getBillByPath(path, function(bill) {
        if (bill == undefined) {
            res.status(404).render('page-not-found', {
                title: "Page not found"
            });
        } else {
            res.render('bill-text', { layout: null, bill: bill });
        }
    });
});

// Handle 404 Errors
app.use(function(req, res, next) {
    res.status(404).render('page-not-found', {
        title: "Page not found"
    });
});

app.listen(3000);