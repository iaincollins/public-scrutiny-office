#!/usr/bin/env node

var mongoJs = require('mongojs');
var xml2js = require('xml2js');
var http = require('http');
var crypto = require('crypto');
var date = new Date();

console.log("Updating Public Scrutiny Office database...");

var databaseUrl = "127.0.0.1/public-scrutiny-office";
var collections = ["bills", "members", "events"];
var db = mongoJs.connect(databaseUrl, collections);
//db.bills.drop();
//db.events.drop();

// Get all bills currently before parliament from the RSS feed
http.get({ host: 'services.parliament.uk', port: 80, path: '/bills/AllBills.rss' }, function(res) {
    
    // Check the response seems okay
    if (res.statusCode != 200) {
        console.log("Unable to fetch list of bills before parliament from services.parliament.uk");
        return;
    }

    // Read the response
    var responseBody = '';    
    res.on("data", function(chunk) {
        responseBody += chunk.toString();
    });
    
    // Parse the response
    res.on("end", function() {
        var parser = new xml2js.Parser();
        parser.parseString(responseBody, function (err, result) {
//            console.log(result.rss.channel[0].item);
            console.log("Found "+result.rss.channel[0].item.length+" bills");
            for (i=0; i<result.rss.channel[0].item.length; i++) {
                var item = result.rss.channel[0].item[i];
                
                var bill = {};                
                // Accessing the GUID value is kind of funky.
                // As it's actually a URL, we make our own from an SHA1 hash of the strong.
                bill.id = crypto.createHash('sha1').update( item.guid[0]._ ).digest("hex");
                bill.name = item.title + ' Bill';
                bill.url = item.link;
                bill.description = item.description;
                bill.year = date.getFullYear();

                // Add bill to database
                addBill(bill);
                
                // Find all events that match the name of this bill (even if just similar) and add them to events
                getEventsForBill(item.title);
            }
        });
    });
});

function addBill(bill) {    
    db.bills.save({
        _id: bill.id,
        year: bill.year,
        name: bill.name,
        description: bill.description,
        url: bill.url
    }, function(err, saved) {
        if (err || !saved) {
            console.log("Could not add bill to DB"+err);
        } else {
            console.log("Bill added: "+bill.name);
        }
    });
}

function getEventsForBill(billName) {
    
    // Get events matching the keywords string from TheyWorkForYou
    http.get({ host: 'www.theyworkforyou.com', port: 80,
               path: '/api/getHansard?key=GfmMVnCm29fQEqvFS7CgLHLJ&search='+encodeURIComponent(billName)+'&output=js'
    }, function(res) {

        // Check the response seems okay
        if (res.statusCode != 200)
            return;

        // Read the response
        var responseBody = '';    
        res.on("data", function(chunk) {
            responseBody += chunk.toString();
        });
    
        // Parse the response
        res.on("end", function() {
            var events = JSON.parse(responseBody);
            for (i=0; i<events.rows.length; i++) {
                var row = events.rows[i];

                // Ignore events that don't have all of these properties
                // (they are not relevant to bills)
                if (!row.title || !row.event_date || !row.link_external)
                    continue;

                var event = {};                
                // Accessing the GUID value is kind of funky.
                // As it's actually a URL, we make our own from an SHA1 hash of the strong.
                event.id = crypto.createHash('sha1').update( row.event_date + row.title ).digest("hex");
                event.name = row.title;
                event.url = row.link_external
                event.date = row.event_date;
        
                if (event.name == "to consider the Bill")
                    event.name = "Consideration of the "+billName+" Bill";

                // Add event to database
                addEvent(event);
            }
        });
    });
}

function addEvent(event) {    
    db.events.save({
        _id: event.id,
        name: event.name,
        url: event.url,
        date: event.date
    }, function(err, saved) {
        if (err || !saved) {
            console.log("Could not add event to DB"+err);
        } else {
            console.log("Event added: "+event.name);
        }
    });
}

// @todo Extract names of members sponsoring the bill by screen scraping.
// @todo Fetch details about the member if not found already (party, constituency, photo, etc)
// @todo Extract the full text of the bill by screen scraping.
