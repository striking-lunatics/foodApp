const express = require('express');
const path = require('path');
const browserify = require('browserify-middleware');
const db = require('./db');
const Brewery = require('./models/brewery.js');
const User = require('./models/users.js');
const Session = require('./models/sessions.js');
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

        var parsedBody = JSON.parse(body);
        // console.log("showing results for nearby radius:", parsedBody.data); 
        // console.log()
        includeBreweryLikes(parsedBody.data)
          .then(function(breweriesWithLikes) {
            console.log("showing breweries after likes added:",breweriesWithLikes);
            parsedBody.data = breweriesWithLikes 
            res.send(parsedBody);
          })

         //console.log('/location: Sending Data')
         // res.send(); 
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
         //console.log('/brewery/beer: Sending Data')
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

         //console.log('/beer/brewery: Sending Data')
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

         //console.log('/city: Sending Data');

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

//add like to database brewery table and brewery-likes join table if user has not previously liked the same brewery
app.post('/brewery/like', function(req, res) {

  console.log("got like request:", req.cookies);  
  Session.findById(req.cookies.sessionId)
    .then(function(data) {
      console.log("returned from session.findById:", data); 

      var userId = data.user_id;
      
      Brewery.findById(req.body.breweryId)
        .then(function(breweryData) {

          if(breweryData.length === 0) {

            Brewery.create(req.body.breweryId, userId)
            .then(function(data) { 

              res.send(201, data[0]); 
            })
          }

          else {
            Brewery.incrementLikes(req.body.breweryId, userId)
              .then(function(data) { 
                if(!data[0]) {
                  res.send(400, "error: user has already liked this brewery!")
                }
                res.send(201, data[0]);
              })
          }
        }) 
    })
}) 


//retrieve user's previously liked breweries upon successful login
app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password; 

  console.log("inside logn endpoint:", username);

  User.findByUsername( username )
    .then(function(user) {
      console.log("showing user:", user);
      if ( ! user ) {
        res.send(400, 'user does not exist! please re-login or signup.');
      }
      else {
        User.comparePassword( user.password, password )
          .then(function (isMatch) {

            if ( ! isMatch ) {
              console.log("Incorrect password")
              res.send(400, 'password is incorrect! please reenter');

            } else {
              Session.create( user.id )
                .then(function (newSessionInfo) { 
                  console.log("showing newSessionInfo:", newSessionInfo); 
                  if(!newSessionInfo.id) {
                    res.send(400, "user is already logged in!")
                  }
                  else {
                    retrieveLikedBreweries(user.id)
                      .then(function(breweryData) {
                        console.log("showing brewery data:", breweryData);
                        res.cookie('sessionId', newSessionInfo.id) 
                        res.send(201, breweryData);
                      }) 
                  }
                })
            }
          });
      }
    });
});

//Helper function called at the end of app.post('/login'). 
//Upon a successful login it retrieves ids of the user's previously liked breweries and then 
//does api calls for each one, returning an array of promised brewery data 

function retrieveLikedBreweries(userId) {

  return Brewery.getLikedBreweries(userId)
    .then(function(breweries) {

      var promises = breweries.map(function(brewery, index) {

        return new Promise(function(resolve, reject) {

          console.log("showing id:",breweries[index].id);
          var url = 'http://api.brewerydb.com/v2/brewery/' + breweries[index].id + '/?key=da506aecce47e548b1877f8c6f9be793'
        
          request(url, function(error, response, body) {

            if (!error && response.statusCode == 200) {
             var data = JSON.parse(body); 
             // console.log("showing likes inside new promise:", brewery.likes);
             // console.log("data from api brewery id call:", data.data); 
             data.data.likes = brewery.likes;
             resolve(data.data);
            }
          })
       
        });

      })  
      return Promise.all(promises);
    })
}

function includeBreweryLikes(companies) {

  console.log("showing breweries:", companies);

  var breweriesWithLikes = companies.map(function(company) {

    return new Promise(function(resolve, reject) {

      db('breweries').select('*').where('id', '=', company  .brewery.id)
        .then(function(rows) { 

          console.log("showing rows:", rows);

          if(rows.length === 0) {
            company.brewery.likes = 0;
          }
          else {
            company.brewery.likes = rows[0].likes;
          }
          resolve(company)
        })
    })
  })

  return Promise.all(breweriesWithLikes);
}

app.get('/logout', function(req, res) {
  Session.destroy( req.cookies.sessionId )
    .then(function () {
      res.clearCookie('sessionId');
      res.redirect('/login');
    })
});

app.post('/signup', function(req, res) { 
  console.log("received request for sign up!");
  var username = req.body.username;
  var password = req.body.password;

  User.findByUsername( username )
    .then(function(user) { 
      console.log("found by username:", username);
      if ( user ) {
        res.send(400, 'account already exists!');
      }
      else {
        User.create({
          username: username,
          password: password
        })
          .then(function(newUserId) { 
            console.log("inserted new user! :", newUserId);
            return Session.create(newUserId);
          })
          .then(function (newSession) { 
            console.log("showing next session:",newSession);
            res.cookie('sessionId', newSession.id).sendStatus(201);
          })
      }
    })
});

function getSignedInUser (req, res, next) {
  var sessionId = req.cookies && req.cookies.sessionId

  if ( ! sessionId ) {
    res.redirect('/login');
  }
  else {
    
    Session.findById( sessionId )
      .then(function (session) {
        if ( ! session ) {
          console.log("invalid session")
          res.redirect('/login')
        }
        else {
          return User.findById( session.user_id )
            .then(function (user) {
              if ( ! user ) {
                console.log("invalid session (no such user)")
                res.redirect('/login')
              }
              else {
                req.user = user
                next();
              }
            })
        }
      })
  }
};


var port = process.env.PORT || 1337;
app.listen(port);
console.log("Listening on localhost:" + port);



