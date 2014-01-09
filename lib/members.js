/**
 * Get members of Parliament
 */
var request = require('request'); // For HTTP requests
var Q = require('q');             // For promises
var crypto = require('crypto');
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
        memberName = memberName.replace(/^Ms /, '');
        memberName = memberName.replace(/^Mrs /, '');
        memberName = memberName.replace(/^Sir /, '');
        memberName = memberName.replace(/^Dr /, '');

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
                thisFunc.getMPByNameFromTheyWorkForYou(memberName)
                .then(function(member) {
                    // Attempt to get extra info from TheyWorkForYou
                    // if we have a valid personId.
                    var deferred2 = Q.defer();
                    if (member.personId) {
                        thisFunc.getMPFromTheyWorkForYou(member)
                        .then(function(theyWorkForYouMember) {
                            member = theyWorkForYouMember;
                            deferred2.resolve(member);
                        });
                    } else {
                        deferred2.resolve(member);
                    }
                    return deferred2.promise;
                })
                .then(function(member) {
                    // If we have valid personId then save to DB
                    if (member.personId) {
                        var deferred2 = Q.defer();
                        // IDs starting with '1-' are from the offical API.
                        // IDs starting with '2-' come from TheyWorkForYou.
                        member._id = '2-'+member.memberId;
                        member.lastUpdated = phpjs.date('Y-m-d');
                        member.path = '/'+member._id+'/'+phpjs.strtolower( member.name.replace(/ /g, '-').replace(/(--.*)/g, '-').replace(/[^A-z0-9-]/g, '').replace(/-$/, '') );
                        db.members.save(member, function(err, saved) {
                            deferred2.resolve(member);
                        });
                        return deferred2.promise;
                    } else {
                        return member;
                    }
                })
                .then(function(member) {
                    var deferred2 = Q.defer();
                    if (member.personId) {
                        // If we have a valid person ID return the member
                        deferred2.resolve(member);
                    } else {
                        // If we don't have a personId after trying to look 
                        // them up as an MP try seeing if they are from the
                        // House of Lords.                        
                        thisFunc.getLordByNameFromTheyWorkForYou(memberName)
                        .then(function(member) {
                            // Attempt to get extra info from TheyWorkForYou
                            // if we have a valid personId.
                            var deferred3 = Q.defer();
                            if (member.personId) {
                                thisFunc.getLordFromTheyWorkForYou(member)
                                .then(function(theyWorkForYouMember) {
                                    member = theyWorkForYouMember;
                                    deferred3.resolve(member);
                                });
                            } else {
                                deferred3.resolve(member);
                            }
                            return deferred3.promise;
                        })
                        .then(function(member) {
                            if (member.memberId) {
                                // IDs starting with '2-' from TheyWorkForYou.
                                member._id = '2-'+member.memberId;
                            } else {
                                // IDs starting with '0-' are internal IDs.
                                member._id = '0-'+crypto.createHash('sha1').update( memberName ).digest("hex");
                            }
                            member.lastUpdated = phpjs.date('Y-m-d');
                            member.path = '/'+member._id+'/'+phpjs.strtolower( member.name.replace(/ /g, '-').replace(/(--.*)/g, '-').replace(/[^A-z0-9-]/g, '').replace(/-$/, '') );
                            db.members.save(member, function(err, saved) {
                                deferred2.resolve(member);
                            });
                        });
                    }
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
    
   this.getMemberById = function(memberId) {
       var thisFunc = this;
       var deferred = Q.defer();
       db.members.find({ _id: memberId }, function(err, members) {
           if (err) {
               deferred.resolve(null);
           } else if (!members.length || members.length < 1) {
               deferred.resolve(null);
           } else {
                deferred.resolve(members[0]);
           }
       });
       return deferred.promise;
   }

   /**
    * Fetch MP info by name from Parliament API
    * @param    string      The name of the MP to fetch (e.g. "David Cameron")  
    */
    this.getMPByNameFromParliament = function(memberName) {
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
                        // Do not have legal permission to use these image URLS.
                        // Requrested, but expressly denied by DODS :(
                        // member.image = "http://assets3.parliament.uk/ext/mnis-bio-person/www.dodonline.co.uk/photos/"+member.dodsId+".jpg.jpg";
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

    /**
     * Fetch MP info by name from TheyWorkForYou
     * @param    string      The name of the MP to fetch (e.g. "David Cameron")  
     */
    this.getMPByNameFromTheyWorkForYou = function(memberName) {
        var thisFunc = this;
        var deferred = Q.defer();

        var member = {};
        member.name = memberName;
        
        request('http://www.theyworkforyou.com/api/getMPs?search='+encodeURI(memberName)+'&key='+config.theyworkforyou.apiKey+'&output=js', function (error, response, body) {
            // Handle errors gracefully
            try {
                // Check the name matches.
                JSON.parse(body).forEach(function(memberObject) {
                    // Loop through all and use any that is an exact match.
                    if (memberObject.name == memberName) {
                        member.memberId = memberObject.member_id;
                        member.personId = memberObject.person_id;
                        member.house = "Commons";
                        member.type = "MP";
                        member.party = memberObject.party;
                        member.constituency = memberObject.constituency;
                        // @todo Get Member Department and/or position if the
                        // to_date is in the future.
                        //member.department = memberObject.office.department
                        //member.position = memberObject.office.position
                    }
                });
                deferred.resolve(member);
            } catch (exception) {
                deferred.resolve(member);
            }
        });
        return deferred.promise;
    };

    /**
     * Fetch pper info by name from TheyWorkForYou
     * @param    string      The name of the peer to fetch, using their offical title (e.g. "Lord McNally")
     *
     * @fixme Will fail on some names - particularly when there are two Lords with the same name.
     */
    this.getLordByNameFromTheyWorkForYou = function(memberName) {
        var thisFunc = this;
        var deferred = Q.defer();

        // Must strip title (e.g. Lord, Earl, etc) when searching TheyWorkForYou
        // e.g. 'Nash' not 'Lord Nash'
        var name = memberName.split(' ');
        lastName = name[name.length - 1];
        
        var member = {};
        member.name = memberName;
        
        request('http://www.theyworkforyou.com/api/getLords?search='+encodeURI(lastName)+'&key='+config.theyworkforyou.apiKey+'&output=js', function (error, response, body) {
            // Handle errors gracefully
            try {
                // Check the name matches.
                JSON.parse(body).forEach(function(memberObject) {
                    // Loop through all and use any that is an exact match.
                    if (memberObject.name == memberName) {
                        member.memberId = memberObject.member_id;
                        member.personId = memberObject.person_id;
                        member.house = "Lords";
                        member.type = "Peer";
                        member.party = memberObject.party;
                    }
                });
                deferred.resolve(member);
            } catch (exception) {
                deferred.resolve(member);
            }
        });
        return deferred.promise;
    };

    /**
     * Fetch additional information about an MP and extend the object passed to it.
     * @param   object      member      A member object (must currently have a valid TheyWorkForYou value in .personId property)
     * @todo Refactor to get additional details.
     * @todo Roll this into getMPByNameFromTheyWorkForYou.
     */
    this.getMPFromTheyWorkForYou = function(member) {
        var deferred = Q.defer();
        request('http://www.theyworkforyou.com/api/getMP?id='+member.personId+'&key='+config.theyworkforyou.apiKey+'&output=js', function (error, response, body) {
            // Handle errors gracefully
            try {
                JSON.parse(body).forEach(function(memberObject) {
                    if (memberObject.image)
                         member.image = "http://www.theyworkforyou.com"+memberObject.image;
                });
            } catch (exception) { }
            deferred.resolve(member);
        });
       return deferred.promise;
    };
    
    /**
     * Fetch additional information about a peer and extend the object passed to it.
     * @param   object      member      A member object (must currently have a valid TheyWorkForYou value in .personId property)
     * @todo Refactor to get additional details.
     * @todo Roll this into getMPByNameFromTheyWorkForYou.
     */
    this.getLordFromTheyWorkForYou = function(member) {
        var deferred = Q.defer();
        request('http://www.theyworkforyou.com/api/getLord?id='+member.personId+'&key='+config.theyworkforyou.apiKey+'&output=js', function (error, response, body) {
            // Handle errors gracefully
            try {
                JSON.parse(body).forEach(function(memberObject) {
                    if (memberObject.image)
                         member.image = "http://www.theyworkforyou.com"+memberObject.image;
                });
            } catch (exception) { }
            deferred.resolve(member);
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