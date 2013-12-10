#!/usr/bin/env node

/**
 * Get the latest vote count for bills that have been before Parliament
 * in the last month (i.e. of recent interest) from the voting service provider.
 *
 * Currently uses likebtn.com as a super cheap (~$20 a year) anonymous voting
 * service provider.
 */

var util = require('util'); // For debugging
var crypto = require('crypto');
var mongoJs = require('mongojs');
var request = require('request');
var xml2js = require('xml2js');
var Q = require('q'); // For promises
var phpjs = require('phpjs'); // Using this for string functions
var billParser = require(__dirname + '/../lib/billparser');
var bills = require(__dirname + '/../lib/bills'); 
var config = require(__dirname + '/../lib/config.json');

var databaseUrl = "127.0.0.1/public-scrutiny-office";
var collections = ["bills", "members", "events"];
var db = mongoJs.connect(databaseUrl, collections);

getBills()
.then(function(billsBeforeParliament) {
    var promises = [];
    billsBeforeParliament.forEach(function(bill, i) {
        var promise = bills.getVotesForBill(bill)
        .then(function(votes) {
            if (votes != null) {
                bill.upVotes = votes.likes;
                bill.downVotes = votes.dislikes;
                return saveBill(bill);
            }
        });
        promises.push(promise);
    });
    return Q.all(promises);
})
.then(function() {
    db.close();
});

function getBills() {
    var deferred = Q.defer();
    var aMonthAgo = phpjs.date('Y-m-d', phpjs.strtotime('1 month ago'));
    var options = { hasText: true, lastUpdated: { $gte: aMonthAgo } };
    bills.getBills(options, function(bills) {
        deferred.resolve(bills);
    });
    return deferred.promise;
}

function saveBill(bill) {
    bill._id = bill.id;
    var deferred = Q.defer();
    db.bills.save( bill, function(err, saved) {
        if (err || !saved) {
            console.log("Could not save changes to DB"+err);
        } else {
            console.log("Updated vote count for Bill: "+bill.name);
        }
        deferred.resolve(bill);
    });
    return deferred.promise;
}