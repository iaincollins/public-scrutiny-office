#!/usr/bin/env node

var util = require('util'); // For debugging
var crypto = require('crypto');
var mongoJs = require('mongojs');
var request = require('request');
var xml2js = require('xml2js');
var Q = require('q'); // For promises
var phpjs = require('phpjs'); // Using this for string functions
var billParser = require(__dirname + '/../lib/billparser');

var date = new Date();

console.log("Updating Public Scrutiny Office database...");

var databaseUrl = "127.0.0.1/public-scrutiny-office";
var collections = ["bills", "members", "events"];
var db = mongoJs.connect(databaseUrl, collections);
// db.bills.drop();
//db.events.drop();

// Get bill details (involves several lookups, hence promises)
// @fixme close DB connection when all bills have been added.
return getBills()
.then(function(bills) {    
    return bills.forEach(function(bill, index) {
         // return billParser.getBillDetails(bill)
         // .then(function(bill) {
         //     // Add bill to database
         //     addBill(bill);
         //     getEventsForBill(bill);
         // });         
        getEventsForBill(bill);
    });
});

function getBills() {
    var deferred = Q.defer();

    var bills = [];
    
    // Get all bills currently before parliament from the RSS feed
    request('http://services.parliament.uk/bills/AllBills.rss', function (error, response, body) {
    
        // Check the response seems okay
        if (response.statusCode != 200) {
            console.log("Unable to fetch list of bills before parliament from services.parliament.uk");
            return;
        }

        var parser = new xml2js.Parser();
        parser.parseString(body, function (err, result) {
            // console.log(result.rss.channel[0].item);
            console.log("Found "+result.rss.channel[0].item.length+" bills");
            for (i=0; i<result.rss.channel[0].item.length; i++) {
                var item = result.rss.channel[0].item[i];
            
                var bill = {};                
                // Accessing the GUID value is kind of funky.
                // As it's actually a URL, we make our own from an SHA1 hash of the strong.
                bill.id = crypto.createHash('sha1').update( item.guid[0]._ ).digest("hex");
                bill.name = phpjs.trim(item.title);
                bill.url = item.link[0];
                bill.description = item.description;
                bill.year = date.getFullYear();
                
                console.log("Bill found: "+bill.name);
                
                bills.push(bill);
            }
        });
        
        deferred.resolve(bills);
        
    });
    
    return deferred.promise;
}

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

function getEventsForBill(bill) {
    
    // Get events matching the keywords string from TheyWorkForYou
    request('http://www.theyworkforyou.com/api/getHansard?key=GfmMVnCm29fQEqvFS7CgLHLJ&search='+encodeURIComponent(bill.name)+'&output=js',
            function (error, response, body) {

        // Check the response seems okay
        if (response.statusCode != 200)
            return;

        var events = JSON.parse(body);
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
            // Special case handling to create more readable event names
            event.name = row.title;                
            if (event.name == "to consider the Bill")
                event.name = "Consideration of the "+bill.name+" Bill";
            if (event.name == bill.name)
                event.name = bill.name+" Bill";
            
            // Some of the event names end in " - /" (with varyign amounts of spaces)
            // This is likely a  result of them being screenscraped by the 
            // TheyWorkForYouAPI (the Parliament website displays events this way)
            event.name = event.name.replace(/(\s*)-(\s*)\/$/g, '');
            
            event.name = phpjs.trim(event.name);
            
            event.url = row.link_external;
            event.date = row.event_date;
        
            // Not logging the full bill object, just what's needed.
            event.bill = {};
            event.bill.id = bill.id;
            event.bill.name = bill.name;
            event.bill.url = bill.url;
            
            // Add event to database
            addEvent(event);
        }
    });

}

function addEvent(event) {    
    db.events.save({
        _id: event.id,
        name: event.name,
        url: event.url,
        date: event.date,
        bill: event.bill
    }, function(err, saved) {
        if (err || !saved) {
            console.log("Could not add event to DB"+err);
        } else {
            console.log("Event added: "+event.name);
        }
    });
}

// @todo Fetch details about the member if not found already (party, constituency, photo, etc)
// @todo Extract the full text of the bill by screen scraping.
