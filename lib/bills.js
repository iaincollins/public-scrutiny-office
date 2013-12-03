function bills() {
    // @todo Create DB module
    this.mongoJs = require('mongojs');
    this.databaseUrl = "127.0.0.1/public-scrutiny-office";
    this.collections = ["bills", "members", "events"];
    
    this.billsBeforeParliament = function(options, callback) {
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
    
    this.getBillByYearAndName = function(year, name, callback) {
        var thisFunc = this;
        var path = '/'+year+'/'+name;        
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
                    callback.call(thisFunc, bill);
                }
            }
            db.close();
        });
    };
}

exports = module.exports = new bills();
exports.bills = bills;