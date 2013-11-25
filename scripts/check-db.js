#!/usr/bin/env node

var mongoJs = require('mongojs');

var databaseUrl = "127.0.0.1/public-scrutiny-office";
var collections = ["bills", "members", "events"];
var db = mongoJs.connect(databaseUrl, collections);

db.bills.find({}, function(err, bills) {
    if (err || !bills.length) {
        console.log("No bills found.");
    } else {
        bills.forEach(function(bill) {
            //console.log(bill);
        });
    }
    console.log(bills.length + " bills found.")
});

db.events.find({}, function(err, events) {
    if (err || !events.length) {
        console.log("No events found.");
    } else {
        events.forEach(function(event) {
            console.log(event);
        });
    }
    console.log(events.length + " events found.")
});

