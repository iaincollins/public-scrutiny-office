var request = require('request'); // For HTTP reuqests
var Q = require('q');             // For promises
var config = require(__dirname + '/config.json');

function bills() {
    // @todo Create DB module
    this.mongoJs = require('mongojs');
    this.databaseUrl = "127.0.0.1/public-scrutiny-office";
    this.collections = ["bills", "members", "events"];
    
    this.getBills = function(options, callback) {
        var thisFunc = this;
        var db = this.mongoJs.connect(this.databaseUrl, this.collections);

        db.bills.find(options, function(err, bills) {
            if (typeof(callback) === "function") {
                if (err || !bills.length) {
                    callback.call(thisFunc, []);
                } else {
                    callback.call(thisFunc, bills);
                }
            }
            db.close();
        });
    };
    
    this.getBillByPath = function(path, callback) {
        var thisFunc = this;
        var db = this.mongoJs.connect(this.databaseUrl, this.collections);
        db.bills.find({ path: path }, function(err, bills) {
            if (typeof(callback) === "function") {
                if (err || !bills.length) {
                    callback.call(thisFunc, undefined);
                } else {
                    var bill = bills[0];
                    // Convert anchor links to links to elsewhere on the current page.
                    if (bill.html != '' && bill.html != null) {
                        bill.html = bill.html.replace(/href="([^#]*)#/g, 'href="#');
                    }
                    
                    // If there is no plain text convertion, create one (hacky!)
                    // Tried using the text-to-html module but it crashes on the broken HTML. :(
                    // @todo Should strip out line numbers and page numbers.
                    // @todo save the plain text version to the DB when fetching bill text.
                    if (bill.text == undefined)
                        bill.text = bill.html.replace(/\<(.*?).\>/g, '').replace(/\)\n/g, ") ").replace(/([0-9])\.\n/g, "$1. ").replace(/([0-9])\n/g, "$1. ").replace(/\n\n\n\n/g, "\n\n");

                    callback.call(thisFunc, bill);
                }
            }
            db.close();
        });
    };
    
    this.getVotesForBill = function(bill) {
        var deferred = Q.defer();

        var apiUrl = 'http://api.likebtn.com/api/?action=stat&email='+config.likebtn.emailAddress+'&api_key='+config.likebtn.apiKey+'&domain='+config.likebtn.domainName+'&page=1&page_size=1&output=json';
        var url = apiUrl+"&identifier_filter="+encodeURI(bill.path);

        // Get all bills currently before parliament from the RSS feed
        request(url, function (error, response, body) {
            // Check the response seems okay
            if (response.statusCode != 200) {
                console.log("*** Unable to fetch votes for Bill.");
                // console.log(response);
                // return;
            }

            // Handle errors gracefully
            try {
                var json = JSON.parse(body);
                var votes = json.response.items[0];
                deferred.resolve(votes);
            } catch (exception) {
                console.log("Couldn't get any votes for the Bill "+bill.name);
                deffered.resolve(null);
            }
        });
        return deferred.promise;
    };
}

exports = module.exports = new bills();
exports.bills = bills;