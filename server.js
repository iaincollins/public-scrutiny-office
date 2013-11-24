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

app.get('/', function(req, res) {
  res.render('index', { });
});

app.get('/about', function(req, res) {
  res.render('about', { });
});

app.get('/bill', function(req, res) {
  res.render('bill', { });
});

app.listen(3000);