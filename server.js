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
    res.redirect('/bills/');
});

app.get('/bills', function(req, res, next) {
    // @fixme Use promises instead of callbacks here
    var bills = require(__dirname + '/lib/bills');
    
    // Only fetch bills that (a) have text and (b) were updated recently
    // (Bills that have not bene updated recently must not have been in the
    // RSS the last time it was parsed so have been dropped or become law.)
    var yesterday = phpjs.date('Y-m-d', phpjs.strtotime('1 day ago'));
    var options = { hasText: true, lastUpdated: { $gte: yesterday } };

    bills.getBills(options, function(billsBeforeParliament) {
        var events = require(__dirname + '/lib/events');
        events.upcomingEvents(function(upcomingEvents) {
            res.render('index', { bills: billsBeforeParliament,
                                  events: upcomingEvents,
                                  title: "Public Scrutiny Office - Review and comment on bills before Parliament" 
                                 });
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

app.get('/bills.json', function(req, res, next) {
    var bills = require(__dirname + '/lib/bills');

    // Only fetch bills that were updated recently.
    // (Bills that have not bene updated recently must not have been in the
    // RSS the last time it was parsed so have been dropped or become law.)
    var yesterday = phpjs.date('Y-m-d', phpjs.strtotime('1 day ago'));
    var options = { lastUpdated: { $gte: yesterday } };
    bills.getBills(options, function(billsBeforeParliament) {
        // Don't return the full text
        billsBeforeParliament.forEach(function(bill, index) {
            billsBeforeParliament[index].html = undefined;
            billsBeforeParliament[index].text = undefined;
        });
        billsBeforeParliament.forEach(function(bill, index) {
            billsBeforeParliament[index].htmlUrl = "http://public-scrutiny-office.org/bills"+bill.path+".html";
            billsBeforeParliament[index].textUrl = "http://public-scrutiny-office.org/bills"+bill.path+".text";
        });
        res.setHeader('Content-Type', 'application/json');
        res.send( JSON.stringify(billsBeforeParliament) );
    });
});

app.get('/sitemap.xml', function(req, res, next) {
    // @fixme Use promises instead of callbacks here
    var bills = require(__dirname + '/lib/bills');
    
    // Only fetch bills that (a) have text and (b) were updated recently
    // (Bills that have not bene updated recently must not have been in the
    // RSS the last time it was parsed so have been dropped or become law.)
    var yesterday = phpjs.date('Y-m-d', phpjs.strtotime('1 day ago'));
    var options = { hasText: true, lastUpdated: { $gte: yesterday } };
    bills.getBills(options, function(billsBeforeParliament) {
        res.setHeader('Content-Type', 'text/plain');
        res.render('sitemap', { layout: null, bills: billsBeforeParliament });
    });
});

app.get('/bills/:year/:name', function(req, res, next) {
    // @fixme Use promises instead of callbacks here
    var bills = require(__dirname + '/lib/bills');
    var filename = req.params.name.split('.');    
    var path = '/'+req.params.year+'/'+filename[0];

    // Optional file extentions are:
    // .json - JSON object of bill (not including bill text)
    // .html - Just the main text of the bill as HTML
    // .text - Just the main text of the bill as plain tet (UTF-8)
    var fileExtention = null;
    if (filename.length > 1)
        fileExtention = filename[1];
        
    bills.getBillByPath(path, function(bill) {
        if (bill == undefined) {
            res.status(404).render('page-not-found', { title: "Page not found" });
        } else {
            switch(fileExtention) {
                case null:
                    res.render('bill', { bill: bill, title: bill.name+' Bill' });
                    break;
                case "json":
                    res.setHeader('Content-Type', 'text/plain; charset="UTF-8"');
                    // Don't return (potentially very large) text in JSON object
                    bill.html = undefined;
                    bill.text = undefined;
                    // Provide URLs to the full text in both HTML and plain text
                    bill.htmlUrl = "http://public-scrutiny-office.org/bills"+bill.path+".html";
                    bill.textUrl = "http://public-scrutiny-office.org/bills"+bill.path+".text";
                    res.send( JSON.stringify(bill) );
                    break;
                case "html":
                    res.render('bill-html', { layout: null, bill: bill, title: bill.name+' Bill' });
                    break;
                case "text":
                    res.setHeader('Content-Type', 'text/plain; charset="UTF-8"');
                    res.send(bill.text);
                    break;
                default:
                    res.status(404).render('page-not-found', { title: "Page not found" });
            }
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