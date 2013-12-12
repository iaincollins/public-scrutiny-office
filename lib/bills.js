/**
 * Fetch bills from the database.
 */
var request = require('request'); // For HTTP requests
var Q = require('q');             // For promises
var config = require(__dirname + '/config.json');

function bills() {

    this.getBills = function(options, callback) {
        var thisFunc = this;

        db.bills.find(options, function(err, bills) {
            if (typeof(callback) === "function") {
                if (err || !bills.length) {
                    callback.call(thisFunc, []);
                } else {
                    callback.call(thisFunc, bills);
                }
            }
        });
    };
    
    this.getBillByPath = function(path, callback) {
        var thisFunc = this;
        db.bills.find({ path: path }, function(err, bills) {
            if (typeof(callback) === "function") {
                if (err || !bills.length) {
                    callback.call(thisFunc, undefined);
                } else {
                    callback.call(thisFunc, bills[0]);
                }
            }
        });
    };
    
    this.getVotesForBill = function(bill) {
        var deferred = Q.defer();

        var apiUrl = 'http://api.likebtn.com/api/?action=stat&email='+config.likebtn.emailAddress+'&api_key='+config.likebtn.apiKey+'&domain='+config.likebtn.domainName+'&page=1&page_size=1&output=json';
        var url = apiUrl+"&identifier_filter="+encodeURI(bill.path);

        // Get all bills currently before parliament from the RSS feed
        request(url, function (error, response, body) {
            // Handle errors gracefully
            try {
                var json = JSON.parse(body);
                var votes = json.response.items[0];
                deferred.resolve(votes);
            } catch (exception) {
                deferred.resolve(null);
            }
        });
        return deferred.promise;
    };
}

exports = module.exports = new bills();
exports.bills = bills;