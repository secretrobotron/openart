var tumblr = require('tumblr.js');
var habitat = require('habitat');
var express = require('express');

habitat.load();

var env = new habitat();
var app = express();

var oauthConfig = env.get('OAUTH');

var tumblrClient = tumblr.createClient(oauthConfig);

app.listen(env.get('PORT'), function(){
  console.log('Express server listening on ' + env.get('HOSTNAME'));
});