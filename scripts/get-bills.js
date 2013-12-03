#!/usr/bin/env node

/**
 * Get the latest bills from the parilament website,
 * related events from TheyWorkForYou and other info
 * related to bills (such as the sponsors).
 *
 * @todo Fetch details about the member if not found already (party, constituency, photo, etc)
 * @todo Extract the full text of the bill by screen scraping.
 */

var util = require('util'); // For debugging
var crypto = require('crypto');
var mongoJs = require('mongojs');
var request = require('request');
var xml2js = require('xml2js');
var Q = require('q'); // For promises
var phpjs = require('phpjs'); // Using this for string functions
var billParser = require(__dirname + '/../lib/billparser');

var date = new Date();

console.log("*** Updating the Public Scrutiny Office database");

var databaseUrl = "127.0.0.1/public-scrutiny-office";
var collections = ["bills", "members", "events"];
var db = mongoJs.connect(databaseUrl, collections);
// db.bills.drop();
// db.events.drop();

// Get bill details (involves several lookups, hence promises)
// @fixme close DB connection when all bills have been added.
var bills;
getBills()
.then(function(bills) {    
    var promises = [];
    bills.forEach(function(bill, index) {
        var promise = billParser.getBillDetails(bill);
        promises.push(promise);
    });
  return Q.all(promises);
})
.then(function(bills) {
    var promises = [];
    bills.forEach(function(bill, index) {
        // Add Bill to DB
        var promise = addBill(bill);
        promises.push(promise);
        
        // Look for events for related to each bill
        var promise = getEventsForBill(bill);
        promises.push(promise);
        
    });
    return Q.all(promises);
})
.then(function() {
    // Make sure appropriate indexes exist
    db.bills.ensureIndex( { "path": 1 } );
    db.bills.ensureIndex( { "hasHtml": 1 } );
    db.bills.ensureIndex( { "lastUpdated": 1 } );
    db.events.ensureIndex( { "date": 1 } );
    
    db.close();
    console.log("*** Finished updating the Public Scrutiny Office database");
});

function getBills() {
    var deferred = Q.defer();

    var bills = [];
    
    // Get all bills currently before parliament from the RSS feed
    request('http://services.parliament.uk/bills/AllBills.rss', function (error, response, body) {
    
        // Check the response seems okay
        if (response.statusCode != 200) {
            console.log("*** Unable to fetch list of bills before parliament from services.parliament.uk");
            console.log(response);
            return;
        }

        var parser = new xml2js.Parser();
        parser.parseString(body, function (err, result) {
            // console.log(result.rss.channel[0].item);
            console.log("Found "+result.rss.channel[0].item.length+" bills in the RSS feed on parliament.uk");
            for (i=0; i<result.rss.channel[0].item.length; i++) {
                var item = result.rss.channel[0].item[i];
                
                var bill = {};
                
                // Accessing the GUID value is kind of funky.
                // As it's actually a URL, we make our own from an SHA1 hash of the strong.
                bill.id = crypto.createHash('sha1').update( item.guid[0]._ ).digest("hex");
                bill.name = phpjs.trim(item.title);
                bill.url = item.link[0];
                bill.description = item.description;
                
                // @fixme The year range should not be hard coded!
                // @todo Look at the current month and year and generate accordingly (e.g. either 2013-2014 or 2014-2015)
                bill.year = '2013-2014';

                // Create "human friendly" path from the bill name
                // e.g. For "Inheritance and Trustees' Powers" generates "/2013-2014/inheritance-and-trustees-powers"
                //
                // @todo It doesn't check for duplicates (SEEMS unlikely in a given session of Parliament though...).
                bill.path = '/'+bill.year+'/';
                // Convert to lower case and convert spaces to hyphens (stripping duplicate & stray hyphens)
                // while removing any chars that are not alphanumeric (or hyphens)
                bill.path += phpjs.strtolower( bill.name.replace(/ /g, '-').replace(/(--.*)/g, '-').replace(/[^A-z0-9-]/g, '') );
                bill.path = bill.path.replace(/-$/, '');

                bills.push(bill);
            }
        });
        
        deferred.resolve(bills);
    });
    return deferred.promise;
}

function addBill(bill) {
    bill._id = bill.id;
    bill.lastUpdated = phpjs.date('Y-m-d');
    
    var deferred = Q.defer();
    db.bills.save( bill, function(err, saved) {
        if (err || !saved) {
            console.log("Could not add bill to DB"+err);
        } else {
            console.log("Bill added: "+bill.name);
        }
        deferred.resolve(bill);
    });
    return deferred.promise;
}

function getEventsForBill(bill) {
    var deferred = Q.defer();
    var promises = [];

    // Get events matching the keywords string from TheyWorkForYou
    request('http://www.theyworkforyou.com/api/getHansard?key=GfmMVnCm29fQEqvFS7CgLHLJ&search='+encodeURIComponent(bill.name)+'&output=js',
            function (error, response, body) {

        // Check the response seems okay
        if (response.statusCode != 200) {
            console.log("*** Invalid HTTP status response (unable to fetch events for bill)");
            console.log(response);
            return;
        }

        var jsonResponse = JSON.parse(body);
        for (i=0; i<jsonResponse.rows.length; i++) {
            var row = jsonResponse.rows[i];

            // Ignore events that don't have all of these properties
            // (they are not relevant to bills)
            if (!row.title || !row.event_date || !row.link_external)
                continue;

            var event = {};
            try {
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
                event.bill.path = bill.path;

            } catch (exception) {
                // Ignore exceptions
            }
            
            var promise = addEvent(event);
            promises.push( promise );
        }
        deferred.resolve( promises );
    });
    return deferred.promise;
}

function addEvent(event) {  
    var deferred = Q.defer();
    
    // Don't add blank events
    if (!event.name)
        return;
        
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
        deferred.resolve(event);
    });
    return deferred.promise;
}