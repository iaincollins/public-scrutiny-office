var express = require('express');
var partials = require('express-partials');
var ejs = require('ejs');

var app = express();

app.use(partials());

app.set('title', 'Public Scrutiny Office');
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('ejs', ejs.__express);
partials.register('.ejs', ejs);

app.get('/', function(req, res, next) {
    res.render('index', {});
});

app.get('/about', function(req, res, next) {
    res.render('about', {});
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
