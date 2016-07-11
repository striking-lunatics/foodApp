var express = require('express');
var path = require('path');
var browserify = require('browserify-middleware');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');


app.use(express.static(path.join(__dirname, "../client/public")));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
 extended: true
}));

app.get('/app-bundle.js',
 browserify('./client/main.js', {
    transform: [ [ require('babelify'), { presets: ["es2015", "react"] } ] ]
  })
);

// Additional middleware which will set headers that we need on each request.
app.use(function(req, res, next) {
 // Set permissive CORS header - this allows this server to be used only as
 // an API server in conjunction with something like webpack-dev-server.
 res.setHeader('Access-Control-Allow-Origin', '*');

 // Disable caching so we'll always get the latest comments.
 res.setHeader('Cache-Control', 'no-cache');
 next();
});

app.post('/location', function(req, res) {

 console.log("runnnning")
 console.log("data:", req.body)
 console.log(req.body.latitude, req.body.longitude)

 const URL = `http://api.brewerydb.com/v2/search/geo/point?radius=100&lat=${req.body.latitude}&lng=${req.body.longitude}&key=a3112121a853b5030fb64addbc45e14a`;



 request(URL, function(error, response, body) {
   if (!error && response.statusCode == 200) {
     res.send(JSON.parse(body));
   } else {
   	console.log("error: ", error)
   }
 })
});

var port = process.env.PORT || 4000;
app.listen(port);
console.log("Listening on localhost:" + port);
