#!/usr/bin/env node

// A development script to make debugging the parsing of bills easier.

var util = require('util');
var billParser = require(__dirname + '/../lib/billparser');

console.log("Fetching bill text...");

var bill = {};
//bill.url = 'http://services.parliament.uk/bills/2013-14/gamblinglicensingandadvertising.html';
bill.url = 'http://services.parliament.uk/bills/2013-14/highspeedraillondonwestmidlands.html';

return billParser.getBillDetails(bill)
.then(function(response) {
    bill = response;
    console.log("Bill object: "+util.inspect(bill, false, null)); 
});