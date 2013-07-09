var tumblr = require('tumblr.js');
var habitat = require('habitat');
var express = require('express');
var os = require('os');
var path = require('path');
var passport = require('passport');
var passportTumblr = require('passport-tumblr');

habitat.load();

var env = new habitat();
var app = express();

var oauthConfig = env.get('OAUTH');
var sessionConfig = env.get('SESSION');
var tumblrConfig = env.get('TUMBLR');

var hostname = env.get('HOSTNAME') || os.hostname();
var port = env.get('PORT');

app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({secret: sessionConfig.secret}));
app.use(passport.initialize());
app.use(passport.session());

function isAuthenticated (req, res, next) {
  if (req.session.authenticated) {
    next();
  }
  else {
    res.redirect('/auth/login');
  }
}

app.get('/', isAuthenticated, function (req, res) {
  res.send('serving!');
});

app.get('/fail', function (req, res) {
  res.send('failed to login :(');
});

var id = 0;

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (id, done) {
  done(null, {});
});

passport.use(new passportTumblr.Strategy({
    consumerKey: oauthConfig.consumer_key,
    consumerSecret: oauthConfig.consumer_secret,
    callbackURL: "http://localhost:3030/auth/tumblr/callback"
  },
  function(token, tokenSecret, profile, done) {
    oauthConfig.token = token;
    oauthConfig.token_secret = tokenSecret;
    done(null, ++id);
  }
));

var tumblrClient;

app.get('/auth/login', passport.authenticate('tumblr'));
app.get('/auth/tumblr/callback', 
  passport.authenticate('tumblr', {failureRedirect: '/auth/login'}),
  function(req, res) {
    req.session.authenticated = true;

    tumblrClient = tumblr.createClient({
      consumer_key: oauthConfig.consumer_key,
      consumer_secret: oauthConfig.consumer_secret,
      token: oauthConfig.token,
      token_secret: oauthConfig.token_secret
    });

    res.redirect('/');
  });

app.use(express.logger('dev'));

app.post('/post', isAuthenticated, function (req, res) {
  var data = req.body.data;
  var type = req.body.type;
  tumblrClient[type](tumblrConfig.blog, {body: data}, function (err, data) {
    res.send('ok: ' + data.id, 200);
  });
});

app.listen(env.get('PORT'), function(){
  console.log('Express server listening on ' + os.hostname() + ':' + env.get('PORT'));
});