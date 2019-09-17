const express = require('express');
const app = express();
const port = 3000;

//Body Parser
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

//CORS
var cors = require('cors');
app.use(cors());
//Authentication
var passport = require('passport'),
  LocalStrategy = require('passport-local').Strategy,
  session = require("express-session"),
  bodyParser = require("body-parser");

app.use(express.static("public"));
app.use(session({ secret: "no-mangoes-here" }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

//Database
var pgp = require('pg-promise')(/* options */);
var db = pgp('postgres://postgres:postgres@localhost:5432/roommate-app');
const PQ = require('pg-promise').ParameterizedQuery;

//Homepage
app.get('/', (req, res) => res.send('Hello World!'));

// ======================== Users ===========================//
app.get('/user/:userId', (req, res) => {
  //console.log(req);
  //TODO: get the user from the database if they exist and return it
  //console.log(db);
  db.one('SELECT $1 AS value', 123)
  .then(function (data) {
    console.log('DATA:', data.value);
    res.send(data);
  })
  .catch(function (error) {
    console.log('ERROR:', error)
    res.send(error);
  });

  //res.send('Requesting user');
});

//User creation
app.post('/user', (req, res, next) => {
  //console.log(req);
  const insertUser = new PQ({text: 'INSERT into app_user (email, password_hash) VALUES ($1, $2)', values: [req.body.email, req.body.password]});

  db.any(insertUser)
    .then(db_res => {
      //console.log(res);
      res.sendStatus(201);
    })
    .catch(err => {
      //console.log(err);
      next(err);
      //res.sendStatus(409);
    });
});

app.get('/users', (req, res, next) => {
  const userQuery = new PQ({text: 'SELECT * from app_user', values: []});

  db.manyOrNone(userQuery)
    .then(db_res => {
      //Get the data, put it in the appropriate json format
      //console.log(db_res);
      res.json(db_res);
    }).catch(err => {
      next(err);
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));