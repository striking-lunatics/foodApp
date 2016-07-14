const express = require('express');
const path = require('path');
const browserify = require('browserify-middleware');
const db = require('./db');
const Brewery = require('./models/brewery.js');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const request = require('request');
const API = 'da506aecce47e548b1877f8c6f9be793';
const LOCATION = {
   lat: null,
   long: null
};
//  Haversine formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
   var R = 6371; // Radius of the earth in km
   var dLat = deg2rad(lat2 - lat1); // deg2rad below
   var dLon = deg2rad(lon2 - lon1);
   var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   var d = R * c; // Distance in km
   return d;
}

function deg2rad(deg) {
   return deg * (Math.PI / 180)
}

app.use(express.static(path.join(__dirname, "../client/public")));

app.use(bodyParser.json());
app.use(cookieParser() );
app.use(bodyParser.urlencoded({
   extended: true
}));

app.get('/app-bundle.js',
   browserify('./client/main.js', {
      transform: [
         [require('babelify'), {
            presets: ["es2015", "react"]
         }]
      ]
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

   console.log(req.body.latitude, req.body.longitude)
      // Get location results with social account information included.
      // withSocialAccounts=Y
      // Radius from point. Defaults to 10 miles.
      // radius=30

   const URL = `http://api.brewerydb.com/v2/search/geo/point?withSocialAccounts=Y&radius=30&lat=${req.body.latitude}&lng=${req.body.longitude}&key=${API}`;

   request(URL, function(error, response, body) {
      if (!error && response.statusCode == 200) {
         console.log('/location: Sending Data')
         res.send(JSON.parse(body));
      } else {
         console.log("/location error: ", error)
      }
   })
});

app.post('/brewery/beer', function(req, res) {

   const breweryID = req.body.breweryId

   //console.log("breweryID", breweryID)

   const URL = `http://api.brewerydb.com/v2/brewery/${breweryID}/beers?key=${API}`;

   request(URL, function(error, response, body) {
      if (!error && response.statusCode == 200) {
         //console.log(JSON.parse(body))
         console.log('/brewery/beer: Sending Data')
         res.send(JSON.parse(body));
      } else {
         console.log("/brewery/beer error: ", error)
      }
   })
});

app.post('/beer/brewery', function(req, res) {

   const beerID = req.body.beerId

   console.log("1: ", beerID)

   const URL = `http://api.brewerydb.com/v2/beer/${beerID}/breweries?key=${API}`;

   request(URL, function(error, response, body) {
      console.log("2: ", body)
      if (!error && response.statusCode == 200) {

         console.log('/beer/brewery: Sending Data')
         res.send(JSON.parse(body));
      } else {
         console.log("/beer/brewery error: ", error)
      }
   })
});

// get location on run
fetchLocation();

function fetchLocation() {
   // fetchLocation
   request('http://ip-api.com/json', function(error, response, body) {
      if (!error && response.statusCode == 200) {
         const IP = JSON.parse(body);
         LOCATION.lat = IP.lat;
         LOCATION.long = IP.lon;
      }
   })
}

// find brewerys based on city, state
app.post('/city', function(req, res) {
   var cityState = req.body.cityState.split(',');
   var city = cityState[0];
   var state = cityState[1];
   var lat = null;
   var long = null;

   var geoURL = `http://maps.google.com/maps/api/geocode/json?address=+${city},+${state}&sensor=false`;
   request(geoURL, function(error, response, body) {
      if (!error && response.statusCode == 200) {
         var data = JSON.parse(body);
         if (data.results[0]) {
            lat = data.results[0].geometry.location.lat;
            long = data.results[0].geometry.location.lng;
         }
      } else {
         console.log("/city error: ", error)
      }
   })

   const URL = ` http://api.brewerydb.com/v2/locations?&locality=${city}&region=${state}&key=${API}`;
   request(URL, function(error, response, body) {
      fetchLocation();
      if (!error && response.statusCode == 200) {

         console.log('/city: Sending Data');

         // this api call does not return distance
         // use helper function to calc and insert into object then send to client
         var distanceKm = getDistanceFromLatLonInKm(LOCATION.lat, LOCATION.long, lat, long);
         var distanceMiles = Math.round(0.62137 * distanceKm);
         // add distance data to all brewerys
         var body = JSON.parse(body);
         if (body.data) {
            //console.log(body.data)
            console.log('distance Miles: ', distanceMiles);
            body.data.forEach(brewery => brewery.distance = distanceMiles);
            res.send(body);
         } else {
            console.log('/city: Error');
         }
      } else {
         console.log("/city error: ", error)
      }
   })
}); 

//add like to database brewery table and user table
app.post('/brewery/like', function(req, res) {


  Brewery.findById(req.body.breweryId)
    .then(function(breweryData) {

      if(breweryData.length === 0) {

        Brewery.create(req.body.breweryId, req.body.userId)
        .then(function(data) { 

          res.send(201, data[0]); 
        })
      }

      else {
        Brewery.incrementLikes(req.body.breweryId, req.body.userId)
          .then(function(data) { 
            if(!data[0]) {
              res.send(400, "error: user has already liked this brewery!")
            }
            res.send(201, data[0]);
          })
      }
    }) 
}) 

app.get('/user/likes', function(req, res) {

  // console.log("showing header:",req.headers.user); 
  var userId = parseInt(req.headers.user);
  Brewery.getLikedBeers(userId)
    .then(function(breweries) {

      var promises = breweries.map(function(brewery, index) {

        return new Promise(function(resolve, reject) {

          console.log("showing id:",breweries[index].id);
          var url = 'http://api.brewerydb.com/v2/brewery/' + breweries[index].id + '/?key=da506aecce47e548b1877f8c6f9be793'
        
          request(url, function(error, response, body) {

            if (!error && response.statusCode == 200) {
             var data = JSON.parse(body);
             console.log("data from api brewery id call:", data.data.name);
             resolve(data.data.name)
            }
          })
       
        });

      })
    
      Promise.all(promises).then(function(value) { console.log("showing inside promise.all:", value);});
    })
});




var port = process.env.PORT || 1337;
app.listen(port);
console.log("Listening on localhost:" + port);










