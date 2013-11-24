function Bills() {
    // @todo Create DB module
    this.mongoJs = require('mongojs');
    this.databaseUrl = "127.0.0.1/public-scrutiny-office";
    this.collections = ["bills", "members", "events"];
}

Bills.prototype.billsBeforeParliament = function(callback) {
    var thisFunc = this;
    var db = this.mongoJs.connect(this.databaseUrl, this.collections);
    db.bills.find({}, function(err, bills) {
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

module.exports = Bills;