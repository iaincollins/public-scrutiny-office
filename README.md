Public Scrutiny Office
======================

This is the source for http://public-scrutiny-office.org - a project designed to promote greater public scrutiny of new leglisation before the UK Parliament.

This started off as a hack for Parliament Hack 2013, which has been ported to nodejs and mongodb, using express, express-partials and ejs for templating and layout and varnish cache in production.

Contributions most welcome.

## API Documentation

You can fetch a list of all bills currently before Parliament at:

http://public-scrutiny-office.org/bills.json

The API returns all Bills that are currently before Parliament or have been recently. This is a more complete list than shown on the website as it also includes Bills for which no text has been submitted yet.

You can use the .hasText property on a Bill to check if there is text available for it and the .htmlUrl and .textUrl properties on each Bill object to get the full text of an individual Bill.

If you know the URL for a bill you can get info for it in JSON, or just the bill text as HTML or plain text (UTF-8) directly by appending an appropriate file extension to the URL.

e.g. for http://public-scrutiny-office.org/bills/2015-2016/investigatory-powers

JSON: http://public-scrutiny-office.org/bills/2015-2016/investigatory-powers.json

HTML: http://public-scrutiny-office.org/bills/2015-2016/investigatory-powers.html

Plain Text: http://public-scrutiny-office.org/bills/2015-2016/investigatory-powers.text

## Installation instructions

To run a copy of this site on your own system:

* Clone the repo and install nodejs and mongodb.
* Run 'npm install' in the root of the repo to get dependancies.
* Copy 'lib/config.json.example' to 'lib/config.json' & edit to configure.
* Run './scripts/get-bills.js' to populate the database.
* Run 'node server.js' and connect to 'localhost:3000' to view the site.

## Acknowlegements

Thank you to Parliament and Rewired State for putting on the hack, to the Parliament folks for being on hand to provide domain expertise and MySociety for the TheyWorkForYou API's.

## Contact

My email address is me@iaincollins.com. You can find me on Twitter as @iaincollins.
