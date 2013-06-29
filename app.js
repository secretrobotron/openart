var tumblr = require('tumblr');
var habitat = require('habitat');
var express = require('express');

habitat.load();

var env = new habitat();
var app = express();

var oauth = env.get('OAUTH');
Object.keys(oauth).forEach(function (key) {
  oauth[key.toLowerCase().substr(5)] = oauth[key];
  delete oauth[key];
});

console.log(oauth);

app.listen(env.get('PORT'), function(){
  console.log('Express server listening on ' + env.get('HOSTNAME'));
});