
// @todo Refactor to not use global vars for libs.
var request = require('request'); // For HTTP reuqests
var Q = require('q');             // For promises
var cheerio = require('cheerio'); // For DOM parsing
var phpjs = require('phpjs');     // Using this for string functions
var htmltidy = require('htmltidy').tidy;

function billParser() {
    this._getBillTypeAndSponsors = function(bill) {
        var deferred = Q.defer();

        this.log("Fetching sponsors for "+bill.name);
            
        request(bill.url, function(error, response, body) {
            
            // Check the response seems okay
            if (response.statusCode != 200) {
                console.log("*** Invalid HTTP status response for "+bill.url);
                console.log(response);
                return;
            }
            
            var $ = cheerio.load(body);

            $('dl[class=bill-agents]').children('dd').each(function(i, elem) {
                // Ignore everything after the first line break in each 'line' and trim.
                var line = $(this).text();            
                line = line.replace(/\r\n(.*)$/mg, '');
                line = phpjs.trim(line);

                if (i == 0) {
                    // The first entry is the bill type
                    bill.type = line;
                    
                    switch(line) {
                        case "Private Members' Bill (Ballot Bill)":
                            bill.type = 'Ballot Bill';
                            break;
                        case "Private Members' Bill (Presentation Bill)":
                            bill.type = 'Presentation Bill';
                            break;
                        case "Private Members' Bill (under the Ten Minute Rule, SO No 23)":
                            bill.type = '10 Minute Rule Bill';
                            break;
                        case "Private Members' Bill (Starting in the House of Lords)":
                            bill.type = 'From the House Of Lords';
                            break;
                        case "Government Bill":
                        case "Private Bill":
                        case "Hybrid Bill":
                        default:
                          bill.type = line;
                    }

                } else {
                    // All subsequent matches are the name of the MP sponsoring the legislation
                    // Ignore any llines in this loop if we encounter a blank line
                    // (means there is no valid data, any lines we add would be bogus)
                    if (line == '')
                        return false;
                    
                    bill.sponsors.push(line);
                }
            });
            deferred.resolve(bill);
        });

        return deferred.promise;
    }
    
    this._getBillDocuments = function(bill) {
        var deferred = Q.defer();

        this.log("Fetching bill documents for "+bill.name);

        var billDocumentsUrl = bill.url.replace(/\.html$/, '/documents.html');
        request(billDocumentsUrl, function(error, response, body) {
    
            var $ = cheerio.load(body);
    
            $('table[class=bill-items]').each(function(i, elem) { 
                // The first table table will be the text of the bill (oldest entries first).
                // The (optional) second table with this class contains "explanatory notes".
                // Any other tables are things like Amendments, Reports, Research Papers,
                // Press Notices, Impact Assesments.
                // I'm just lumping them all in "other" for now.
                $('td[class=bill-item-description] a', this).each(function(j, elem) { 
                    var document = {};
                    document.url = $(this).attr('href');
                    document.name = $(this).text();
            
                    // Ignore links to non HTML resources (e.g. PDF's)
                    if (!document.url.match(/\.htm/) && !document.url.match(/\.html/))
                        return;
    
                    if (i == 0) {
                        bill.documents.versions.push( document );
                    } else if (i ==1 ) {
                        bill.documents.notes.push( document );
                    } else {
                        bill.documents.other.push( document );
                    }
    
                });
        
            });

            deferred.resolve(bill);
    
        });

         return deferred.promise;
    }

    this._getBillTextPages = function(bill) {
        var deferred = Q.defer();

        var billParser = this;
        
        bill.pages = [];        

        this.log("Determining bill text pages for "+bill.name);
        
        // If there aren't any bill documents yet, there is nothing to try and fetch.
        if (bill.documents.versions.length == 0)
            return bill;
            
        // Get the bill text from the most recent version (i.e. the last one in the array) 
        var url = bill.documents.versions[bill.documents.versions.length - 1].url;

        request(url, function(error, response, body) {

            // Check the response seems okay
            if (response.statusCode != 200) {
                console.log("*** Invalid HTTP status response for "+url);
                console.log(response);
                return;
            }

            try {
                var $ = cheerio.load(body);

                // Remove filename from URL
                var baseUrl = url.replace(/[^\/]*$/, '');

                // Get the URLs of all pages that make up this bill
                // (by looking in the pagination element)
                var lastPageUrl = $('span[class=LegLastPage] a').attr('href');
        
                // Strip everything upto and including the last underscore and the .htm at the end to get the number of pages
                // e.g. a page name like 'cbill_2013-20140132_en_16.htm' means there are 16 pages.
                var numberOfPages = lastPageUrl.replace(/(.*)_/, '').replace(/\.htm/, '');

                // Strip the number and .htm suffix to get the name of the page
                var pageName = lastPageUrl.replace(/([\d]*)\.htm$/, '');
                        
                for (var i = 1; i <= numberOfPages; i++) {
                    bill.pages.push( baseUrl+pageName+i+'.htm' );
                }
            } catch (exception) {
                // Often there aren't any bill text pages yet.
                // This causes the regex to fail. We just ignore errors here and assume there is no text yet.
                billParser.log("Couldn't find any text for the bill "+bill.name+" (ignoring).");
            }
            
            deferred.resolve(bill);
        });    
        return deferred.promise;
    }

    this._getBillTextFromPage = function(pageUrl) {
        var deferred = Q.defer();
        
        this.log("Fetching bill text from "+pageUrl);
        
        request(pageUrl, function(error, response, body) {

            // Check the response seems okay
            if (response.statusCode != 200) {
                console.log("*** Invalid HTTP status response for "+pageUrl);
                console.log(response);
                return;
            }

            var $ = cheerio.load(body);
            var text = $('div[class=LegContent]').html();
            
            deferred.resolve(text);
        });
        return deferred.promise;
    }
    
    this.log = function(message) {
        // Uncomment for debugging
        // console.log(message);
    }
}

billParser.prototype.getBillDetails = function(bill) {
    var billParser = this;
    
    var deferred = Q.defer();

    // The following properties will be updated by the promise chain below.
    bill.type;
    bill.sponsors = [];
    bill.html;
    bill.documents = {};
    bill.documents.versions = [];
    bill.documents.notes = [];
    bill.documents.other = [];

    // Promise chain for multiple HTTP request
    // Get all Bill sponsors (and the type of bill)
    billParser._getBillTypeAndSponsors(bill)
    .then(function(bill) {
        // Get the URL for all documents associated with the bill
        return billParser._getBillDocuments(bill);
    })
    .then(function(bill) {
        // Get all the HTML text pages for the bill
        return billParser._getBillTextPages(bill);
    })
    .then(function(bill) { 
        // Fetch the text from each bill page and concatinate them
                
        // If there are no bill pages, just return an empty string
        // (the text of the bill probably hasn't been uploaded yet)
        if (bill.pages.length == 0)
            return '';
            
        var promises = [];
        bill.pages.forEach(function(pageUrl, index) {
            billParser.log("Fetching text from "+pageUrl+" for "+bill.name);
            var promise = billParser._getBillTextFromPage(pageUrl);
            promises.push(promise);
        });
        return Q.all(promises);
    })
    .then(function(pagesOfRawHtml) {
        if (pagesOfRawHtml.length > 0) {
            // Join the array of all pages together (does toString() just do that on arrays anyway?)
            var rawHtml = '';
            pagesOfRawHtml.forEach(function(pageOfRawHtml, index) {
                rawHtml += pageOfRawHtml;
            });

            // Fixes common invalid HTML errors
            rawHtml = rawHtml.replace(/shape="rect"/g, '');
            rawHtml = rawHtml.replace(/\<br clear="none"\>/g, '<br class="clearfix"/>');
            rawHtml = rawHtml.replace(/\<acronymn/g, '<abbr');
            rawHtml = rawHtml.replace(/\<\/acronym\>/g, '</abbr>');
            
            return rawHtml;
            
            // This is disabled for now as in production it's failing to parse
            // some bills (resulting in blank text). Even when it works it's not
            // managing to fix the problems I was trying to use it to fix.
            //
            // Tidy the HTML up before saving it to the DB.
            // var deferredParser = Q.defer();
            // htmltidy(rawHtml, { outputHtml: true, hideComments: true }, function(err, html) {
            //     // Extract only the <body> of the newly tidied page
            //     var $ = cheerio.load(html);
            //     var body = $('body').html()
            //     deferredParser.resolve(body);
            // });
            // return deferredParser.promise;
        } else {
            // If there aren't any pages, then return an empty string.
            return '';
        }
    })
    .then(function(tidyHtml) {
        // Return the bill (complete with parsed text)
        bill.html = tidyHtml;
        
        // Adding a bool value to bills to make it faster to determine if a copy of the
        // the bill is available yet (so can more easily/quickly hide bills which don't
        // have text yet by using an efficiently indexed attribute).
        if (bill.html == '') {
            bill.hasHtml = false;
        } else {
            bill.hasHtml = true;
        }
        
        billParser.log("Finished parsing "+bill.name);
        deferred.resolve(bill);
    });

    return deferred.promise;
};

exports = module.exports = new billParser();
exports.billParser = billParser;
