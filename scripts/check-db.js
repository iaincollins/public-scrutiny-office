#!/usr/bin/env node

// A script to quickly check the number of bills and events currently in the DB.

var mongoJs = require('mongojs');

GLOBAL.db = mongoJs.connect("127.0.0.1/public-scrutiny-office", ["bills", "members", "events"]);

db.bills.find({}, function(err, bills) {
    if (err) {
        console.log("Unable to get bills.");
    } else {
        bills.forEach(function(bill) {
           // console.log(bill);
        });
    }
    console.log(bills.length + " bills found.")
});

db.events.find({}, function(err, events) {
    if (err) {
        console.log("Unable to get events.");
    } else {
        events.forEach(function(event) {
           // console.log(event);
        });
    }
    console.log(events.length + " events found.")
});

db.members.find({}, function(err, members) {
    if (err) {
        console.log("Unable to get members.");
    } else {
        members.forEach(function(member) {
           // console.log(member);
        });
    }
    console.log(members.length + " members found.")
});