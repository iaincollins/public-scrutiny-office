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
        
        // Normalize member names (for consistency)
        memberName = phpjs.trim(memberName);
        memberName = memberName.replace(/^Mr /, '');
        memberName = memberName.replace(/^Mrs /, '');

        // Used to normalize names like "Michael Thornton" to "Mike Thornton"
        // (which he actually goes by).
        // This shouldn't really be different when on Bills but sometimes it is.
        var aliases = require(__dirname + '/aliases.json');
        if (aliases[memberName])
            memberName = aliases[memberName];
        
        var thisFunc = this;
        var deferred = Q.defer();
        db.members.find({ name: memberName }, function(err, members) {
            if (err) {
                deferred.resolve(null);
            } else if (!members.length || members.length < 1) {
                // If not found then try to look up the member via API
                thisFunc.getMemberDetailsFromParliament(memberName)
                .then(function(member) {
                    if (member.party) {
                        var deferred2 = Q.defer();
                        member.lastUpdated = phpjs.date('Y-m-d');
                        db.members.save(member, function(err, saved) {
                            deferred2.resolve(member);
                        });
                        return deferred2.promise;
                    } else {
                        return member;
                    }
                })  
                .then(function(member) {
                    // If we don't have party details for the member after 
                    // calling getMemberDetailsFromParliament() then try
                    // looking up TheyWorkForYou to see if the member is
                    // from the House of Lords.
                    if (!member.party) {
                        var deferred2 = Q.defer();
                        member = thisFunc.getLordDetailsFromTheyWorkForYou(memberName)
                        .then(function(member) {
                            member.lastUpdated = phpjs.date('Y-m-d');
                            db.members.save(member, function(err, saved) {
                                deferred2.resolve(member);
                            });
                        });
                        return deferred2.promise;
                    } else {
                        return member;
                    }
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
        member.name = memberName;
        
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
                        member.type = "MP";
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
    
    this.getLordDetailsFromTheyWorkForYou = function(memberName) {
        var deferred = Q.defer();

        // Must strip title (e.g. Lord, Earl, etc) when searching TheyWorkForYou
        // e.g. 'Nash' not 'Lord Nash'
        var name = memberName.split(' ');
        lastName = name[name.length - 1];
        
        var member = {};
        member.name = memberName;
        request(' http://www.theyworkforyou.com/api/getLords?search='+encodeURI(lastName)+'&key='+config.theyworkforyou.apiKey+'&output=js', function (error, response, body) {
            // Handle errors gracefully
            try {
                // Check the name matches.
                JSON.parse(body).forEach(function(memberObject) {
                    // Loop through all and use any that is an exact match.
                    if (memberObject.name == memberName) {
                        member.memberId = memberObject.member_id;
                        member.party = memberObject.party;
                        member.house = "Lords";
                        member.type = "Peer";
                    }
                });
                deferred.resolve(member);
            } catch (exception) {
                deferred.resolve(member);
            }
        });
        return deferred.promise;
    };

    this.getMembers = function(type) {
        var deferred = Q.defer();
        
        var query = {};
        if (type !== 'undefined')
           query = { type: type }; // e.g. 'MP', 'Peer'

        db.members.find({ $query: query, $orderby: { party: 1 } }, function(err, members) {
            if (err) {
                deferred.resolve([]);
            } else {
                deferred.resolve(members);
            }
        });
        return deferred.promise;
    };

}

exports = module.exports = new members();
exports.members = members;