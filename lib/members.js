/**
 * Get members of Parliament
 */
var request = require('request'); // For HTTP requests
var Q = require('q');             // For promises
var xml2js = require('xml2js');
var config = require(__dirname + '/config.json');
var phpjs = require('phpjs');

function members() {

    /**
     * Get a Member of Parliament by name.
     *
     * If there is no info, attempts to look them up on
     * data.parliament.uk and cache the response before returning.
     */
    this.getMemberByName = function(memberName) {
        var thisFunc = this;
        var deferred = Q.defer();
        db.members.find({ name: memberName }, function(err, members) {
            if (err) {
                deferred.resolve(null);
            } else if (!members.length || members.length < 1) {
                // If not found then try to look up the member via API
                thisFunc.getMemberDetailsFromParliament(memberName)
                .then(function(member) {
                    var deferred2 = Q.defer();
                    member.lastUpdated = phpjs.date('Y-m-d');
                    db.members.save(member, function(err, saved) {
                        deferred2.resolve(member);
                    });
                    return deferred2.promise;
                })  
                .then(function(member) {
                    // Return member object
                    deferred.resolve(member);
                });
            } else {
                // If found in DB, return cached version of member object
                deferred.resolve(members[0]);
            }
        });
        return deferred.promise;
    };
    
    /**
     * Fetch multiple members at once (as an array)
     */
    this.getMembersByName = function(members) {
        var thisFunc = this;
        var promises = [];
        if (members.length > 0) {
            members.forEach(function(memberName) {
               var promise = thisFunc.getMemberByName(memberName);
               if (promise != null)
                   promises.push(promise);
            });
        }
        return Q.all(promises);
    }

    this.getMemberDetailsFromParliament = function(memberName) {
        var deferred = Q.defer();
        
        var member = {};
        member.name = phpjs.trim(memberName);
        
        request('http://data.parliament.uk/membersdataplatform/services/mnis/members/query/name*'+encodeURI(member.name)+'/', function (error, response, body) {
            // Handle errors gracefully
            try {
                var parser = new xml2js.Parser();
                parser.parseString(body, function (err, result) {
                    if (result.Members.Member) {
                        member.memberId = result.Members.Member[0].$.Member_Id;
                        member.dodsId = result.Members.Member[0].$.Dods_Id;
                        member.pimsId = result.Members.Member[0].$.Pims_Id;
                        member.party = result.Members.Member[0].Party[0]._.toString();
                        member.house = result.Members.Member[0].House.toString();
                        member.constituency = result.Members.Member[0].MemberFrom.toString();
                    }
                    deferred.resolve(member);
                });
            } catch (exception) {
                deferred.resolve(member);
            }
        });
        return deferred.promise;
    };
}

exports = module.exports = new members();
exports.members = members;