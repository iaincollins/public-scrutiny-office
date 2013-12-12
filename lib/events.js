/**
 * Display events stored in the database.
 */
function events() {
    this.upcomingEvents = function(callback) {
        var thisFunc = this;
        var date = new Date();
        var dateString = phpjs.date('Y-m-d');
        db.events.find({date: { "$gt": dateString }}).sort('date', function(err, events) {
            if (typeof(callback) === "function") {
                if (err || !events.length) {
                    callback.call(thisFunc, []);
                } else {
                    callback.call(thisFunc, events);
                }
            }
        });
    };
}

exports = module.exports = new events();
exports.events = events;