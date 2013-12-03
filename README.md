Public Scrutiny Office
======================

This is the source for a project designed to enable greater public scrutiny of Parliament in the UK.

It's a port of a hack I did for Parliament Hack 2013 from PHP to nodejs and mongodb, using express, express-partials and ejs for templating and layout and varnish cache in production.

It's up and running over at http://public-scrutiny-office.org

To run a copy of this site on your own system:

1) install nodejs and mongodb.
2) run 'npm install' to get dependancies.
3) copy 'lib/config.json.example' to 'lib/config.json' & edit to configure.
4) run './scripts/get-bills.js' to populate the DB with bills and .
5) run 'node server.js' and connect to 'localhost:3000' to view the site.

Contributions most welcome!

Thank you to Parliament and Rewired State for putting on the hack, to the Parliament folks for being on hand to provide domain expertise and MySociety for the TheyWorkForYou API's.
