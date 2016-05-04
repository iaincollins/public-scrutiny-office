/**
 * This is used to scrape bills from the parliament.uk website and wrangle them 
 * into something a little more readable. Creates simple HTML and plain text
 * versions of each bill.
 */

var request = require('request'); // For HTTP requests
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
            if (!response || !response.statusCode || response.statusCode != 200) {
                console.log("*** Invalid HTTP status response for "+bill.url);
                //console.log(response);
                deferred.resolve(bill);
                return;
            }
            
            var $ = cheerio.load(body);

            $('dl[class=bill-agents]').children('dd').each(function(i, elem) {
                // Ignore everything after the first line break in each 'line'
                // and trim the text.
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
                    // All subsequent matches are the name of the MP sponsoring 
                    // the legislation.
                    //
                    // We gnore any lines in this loop if we encounter a blank
                    // line (as that means there is no valid data, any lines we
                    // add would be bogus).
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
                // The first table table will be the text of the bill (oldest 
                // entries first).
                //
                // The (optional) second table with this class contains
                // "explanatory notes".
                //
                // Any other tables are things like Amendments, Reports,
                // Research Papers, Press Notices and Impact Assesments.
                //
                // I'm just lumping them all in "other" for now.                
                //
                // @todo Check document filenames for keywords.
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
        
        // If there aren't any Documents yet, there is nothing to try and fetch.
        if (bill.documents.versions.length == 0)
            return bill;
            
        // Get the Bill text from the most recent version (the last array entry)
        var url = bill.documents.versions[bill.documents.versions.length - 1].url;

        request(url, function(error, response, body) {

            // Check the response seems okay
            if (!response || !response.statusCode || response.statusCode != 200) {
                console.log("*** Invalid HTTP status response for "+url);
                //console.log(response);
                deferred.resolve(bill);
                return;
            }

            try {
                var $ = cheerio.load(body);

                // Remove filename from URL
                var baseUrl = url.replace(/[^\/]*$/, '');

                // Get the URLs of all pages that make up this bill
                // (by looking in the pagination element)
                var lastPageUrl = $('span[class=LegLastPage] a').attr('href');
        
                // Strip everything upto and including the last underscore and 
                // the .htm at the end to get the number of pages.
                // e.g. a page name like 'cbill_2013-20140132_en_16.htm' means
                // there are 16 pages.
                var numberOfPages = lastPageUrl.replace(/(.*)_/, '').replace(/\.htm/, '');

                // Strip the number and .htm suffix to get the name of the page
                var pageName = lastPageUrl.replace(/([\d]*)\.htm$/, '');
                        
                for (var i = 1; i <= numberOfPages; i++) {
                    bill.pages.push( baseUrl+pageName+i+'.htm' );
                }
            } catch (exception) {
                // Often there aren't any Bill text pages yet. This causes the
                // regex to fail. We just ignore errors here and treat it as if
                // there is no text for the Bill available yet.
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
            if (!response || !response.statusCode || response.statusCode != 200) {
                console.log("*** Invalid HTTP status response for "+pageUrl);
                //console.log(response);
                deferred.resolve('');
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
    .then(function(pagesOfHtml) {
        if (pagesOfHtml.length > 0) {
            // Join the array of all pages together (does toString() just do that on arrays anyway?)
            var html = '';
            pagesOfHtml.forEach(function(pageOfHtml, index) {
                html += pageOfHtml;
            });
            
            // Clean up and simplify HTML.
            
            // Convert anchor links to links to local links
            // (removing any reference to a specific page name)
            html = html.replace(/href="([^#]*)#/g, 'href="#');

            // Strip out line numbers
            html = html.replace(/<ins class="linenumber">(.*?)<\/ins>/g, '');

            // Stip out page numbers
            html = html.replace(/<div class="newPage">(.*?)<\/div>/g, '');
            html = html.replace(/<div class="chunkPage">(.*?)<\/div>/g, '');

            // Remove tags to simplify HTML
            html = html.replace(/<coverpara(.*?)>/g, '');
            html = html.replace(/<\/coverpara>/g, '');

            html = html.replace(/<rubric(.*?)>/g, '');
            html = html.replace(/<\/rubric>/g, '');

            html = html.replace(/<abbr(.*?)>/g, '');
            html = html.replace(/<\/abbr>/g, '');

            html = html.replace(/<acronym(.*?)>/g, '');
            html = html.replace(/<\/acronym>/g, '');

            // Strip out classes
            html = html.replace(/class="(.*?)"/g, ''); 

            // Strip out unwanted attributes
            html = html.replace(/xmlns="(.*?)"/g, ''); 
            html = html.replace(/shape="rect"/g, '');

            // Strip out line breaks
            html = html.replace(/<br (.*?)>/g, '');
            
            return html;
            
            // This is disabled for now as in production it's failing to parse
            // some bills (resulting in blank text).
            //
            // Even when it works it's not managing to fix the problems I was
            // trying to use it to fix, so I've resorted to regex wrangling.
            //
            // Tidy the HTML up before saving it to the DB.
            // var deferredParser = Q.defer();
            // htmltidy(html, { outputHtml: true, hideComments: true }, function(err, html) {
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
    .then(function(html) {
        // Return the bill with HTML and UTF-8 text versions
        bill.html = html;
        
        // Very simple HTML-to-text hacky conversion of HTML to text.
        // NB: Tried using libraries (like html-to-text) but they failed parsing the HTML
        bill.text = bill.name+" Bill\n"+html.replace(/<(.*?).>/g, '').replace(/\)\n/g, ") ").replace(/([0-9])\.\n/g, "$1. ").replace(/([0-9])\n/g, "$1. ").replace(/\n\n(\n*)\n/g, "\n\n");
 
        // Adding a bool value to bills to make it faster to determine if a 
        // copy of the the bill is available yet (so can more easily/quickly
        // hide bills which don't have text yet by using an efficiently indexed
        // attribute).
        if (bill.html == '') {
            bill.hasText = false;
        } else {
            bill.hasText = true;
        }

        billParser.log("Finished parsing "+bill.name);
        deferred.resolve(bill);
    });

    return deferred.promise;
};

exports = module.exports = new billParser();
exports.billParser = billParser;
