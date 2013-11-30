#!/usr/bin/env node

var mongoJs = require('mongojs');
var xml2js = require('xml2js');
var http = require('http');
var crypto = require('crypto');
var request = require('request');
var Q = require('q');
var util = require('util');

// Usingc heerio for DOM parsing
var cheerio = require("cheerio");

// Using phpjs for string functions
var phpjs = require('phpjs');

console.log("Fetching bill text...");

var databaseUrl = "127.0.0.1/public-scrutiny-office";
var collections = ["bills", "members", "events"];
var db = mongoJs.connect(databaseUrl, collections);

var url = 'http://services.parliament.uk/bills/2013-14/gamblinglicensingandadvertising.html';
//var url = 'http://services.parliament.uk/bills/2013-14/highspeedraillondonwestmidlands.html';

// Get all bills currently before parliament from the RSS feed
request(url, function(error, response, body) {
    
    // Check the response seems okay
    if (response.statusCode != 200)
        return;

    var bill = {};
    bill.url = url;
    bill.type;
    bill.sponsors = [];
    bill.text;
    bill.documents = [];
    bill.documents.versions = [];
    bill.documents.notes = [];
    bill.documents.other = [];
    
    var $ = cheerio.load(body);

    $('dl[class=bill-agents]').children('dd').each(function(i, elem) {
        // Ignore everything after the first line break in each 'line' and trim.
        var line = $(this).text();            
        line = line.replace(/\r\n(.*)$/mg, '');
        line = phpjs.trim(line);
        
        if (i == 0) {
            // The first entry is the bill type
            bill.type = line;
        } else {
            // All subsequent matches are the name of the MP sponsoring the legislation
            bill.sponsors.push(line);
        }        
    });
    
    var fullTextUrl = $('td[class=bill-item-description] a').attr('href');
    

    // Using promises to get all bill documents.
    return getBillDocuments(bill)
    .then(function(bill) {
        return getBillTextPages(bill);
    })
    .then(function(bill) { 
        // Fetch the text from each bill page
        var promises = [];
        bill.pages.forEach(function(pageUrl, index) {
            var promise = getBillTextFromPage(pageUrl, bill);
            promises.push(promise);
        });
        return Q.all(promises);
    })
    .then(function(text) {
        bill.html = text;
        console.log("Bill object: "+util.inspect(bill, false, null));
    });
    
});

function getBillDocuments(bill) {
    var deferred = Q.defer();

    var billDocumentsUrl = bill.url.replace(/\.html$/, '/documents.html');
    request(billDocumentsUrl, function(error, response, body) {
        
        var $ = cheerio.load(body);
        
        $('table[class=bill-items]').each(function(i, elem) { 
            // The first table table will be the text of the bill (oldest entries first).
            // The (optional) second table with this class contains "explanatory notes".
            // Any other tables are things like Amendments, Reports, Research Papers,
            // Press Notices, Impact Assesments.
            // I'm just lumping them all in "other" for now.
            $('td[class=bill-item-description] a', this).each(function(j, elem) { 
                var document = {};
                document.url = $(this).attr('href');
                document.name = $(this).text();
                
                // Ignore links to non HTML resources (e.g. PDF's)
                if (!document.url.match(/\.htm/) && !document.url.match(/\.html/))
                    return;
        
                if (i == 0) {
                    bill.documents.versions.push( document );
                } else if (i ==1 ) {
                    bill.documents.notes.push( document );
                } else {
                    bill.documents.other.push( document );
                }
        
            });
            
        });

        deferred.resolve(bill);
        
    });

     return deferred.promise;
}


function getBillTextPages(bill) {
    var deferred = Q.defer();

    // Get the bill text from the most recent version (i.e. the last one in the array) 
    var url = bill.documents.versions[bill.documents.versions.length - 1].url;

    request(url, function(error, response, body) {
        // Check the response seems okay
        if (response.statusCode != 200)
            return;

        var $ = cheerio.load(body);

        // Remove filename from URL
        var baseUrl = url.replace(/[^\/]*$/, '');

        // Get the URLs of all pages that make up this bill
        // (by looking in the pagination element)
        bill.pages = [];        
        $('p[class=LegNavTextTop] a').each(function(i, elem) {
            var billPageUrl = baseUrl+$(this).attr('href');
            
            // Only insert each URL once (with short bill text some URLs occur twice in the pagination element)
            if (bill.pages.indexOf(billPageUrl) <= 0)
                bill.pages.push( billPageUrl );
        });
        
        deferred.resolve(bill);
    });    
    return deferred.promise;
}

function getBillTextFromPage(pageUrl) {
    var deferred = Q.defer();
    request(pageUrl, function(error, response, body) {

        // Check the response seems okay
        if (response.statusCode != 200)
            return;
    
        // Get the content from the page (using a selector to ignore the header and footer)
        var $ = cheerio.load(body);
        var text = $('div[class=LegContent]').html();
        
        deferred.resolve(text);
    });
    return deferred.promise;
}