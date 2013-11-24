function Events() {
    // @todo Create DB module
    this.mongoJs = require('mongojs');
    this.databaseUrl = "127.0.0.1/public-scrutiny-office";
    this.collections = ["bills", "members", "events"];
}

Events.prototype.upcomingEvents = function(callback) {
    var thisFunc = this;
    var date = new Date();
    var dateString = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
    var db = this.mongoJs.connect(this.databaseUrl, this.collections);
    db.events.find({date: { "$gt": dateString }}).sort('date', function(err, events) {
        if (typeof(callback) === "function") {
            if (err || !events.length) {
                callback.call(thisFunc, []);
            } else {
                callback.call(thisFunc, events);
            }
        }
        db.close();
    });
};

module.exports = Events;