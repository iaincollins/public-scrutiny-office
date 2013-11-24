#!/usr/bin/env node

var mongoJs = require('mongojs');

console.log("Updating Public Scrutiny Office database...");

var databaseUrl = "127.0.0.1/public-scrutiny-office";
var collections = ["bills", "members", "events"];
var db = mongoJs.connect(databaseUrl, collections);

// @todo Generate Bill ID from SHA hash of GUID value in RSS feed
// @todo If exists in DB, ignore (if not, save).
db.bills.save({
    //    _id: "",
    year: "2013",
    name: "the-name-of-the-bill",
    title: "The name of the bill",
    description: "A description of the bill"
}, function(err, saved) {
    if (err || !saved) {
        console.log("Bill not saved");
    } else {
        console.log("Bill saved");
    }

    db.close();
});

// @todo Fetch latest bills before Parliament from RSS feed.
// @todo Extract names of members sponsoring the bill by screen scraping.
// @todo Fetch details about the member if not found already (party, constituency, photo, etc)
// @todo Extract the full text of the bill by screen scraping.
// @todo Search for related events on TheyWorkForYou
