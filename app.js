var express = require('express');
var habitat = require('habitat');
var os = require('os');
var mongoose = require('mongoose');
var Feed = require('feed');

habitat.load();

var env = new habitat();

var express = require('express');
var app = express();

var port = env.get('PORT');
var hostname = env.get('HOSTNAME') || os.hostname();
var allowedDomains = (env.get('ALLOWED_DOMAINS') || '').split(' ');
var allowedIPs = (env.get('ALLOWED_IPS') || '').split(' ');

app.use(express.bodyParser());

mongoose.connect(env.get('DB_URL'));

var Item = mongoose.model('Item', {
  url: String,
  description: String,
  date: Date,
  title: String,
  image: String,
  author: String
});

var feedConfig = env.get('FEED');

var feed = new Feed({
  title: feedConfig.title,
  description: feedConfig.description,
  link: feedConfig.url,
  image: feedConfig.image,
  author: {
    name: feedConfig.author_name || '',
    link: feedConfig.author_link || '',
    email: feedConfig.author_email || ''
  }
});

var rssOutputString, atomOutputString;

function addItemToFeed (item) {
  feed.item({
    title: item.title || '',
    description: item.description || '',
    link: item.url || '',
    author: [{
      name: item.author || ''
    }],
    date: item.date,
    image: item.image || ''
  });

  rssOutputString = feed.render('rss-2.0');
  atomOutputString = feed.render('atom-1.0');
}

function allowCorsRequests (req, resp, next) {
  var origin = req.get('origin'); // TODO: Check if this is spoof-proof

  /**
   * Browsers don't support passing a single list so we have to loop
   * and return a single domain when we detect a match
   */
  allowedDomains.forEach(function(el, index, array) {
    if (origin === el) {
      resp.header('Access-Control-Allow-Origin', el);
    }
  });
  resp.header('Access-Control-Allow-Methods', 'POST');
  // Access-Control-Allow-Headers
  next();
};

app.use(allowCorsRequests);

app.get(feedConfig.rss_path, function (req, res) {
  res.send(rssOutputString, 200);
});

app.get(feedConfig.atom_path, function (req, res) {
  res.send(atomOutputString, 200);
});

app.post('/post', function (req, res) {
  if (allowedIPs.indexOf(req.connection.remoteAddress) === -1) {
    res.send('No.', 500);
    return;
  }

  var url = req.body.url;
  var image = req.body.image || '';
  var description = req.body.description || '';
  var title = req.body.title || description;
  var author = req.body.author || 'anonymous';

  if (!(url)) {
    res.send('No.', 500);
    return;
  }

  var item = new Item({
    url: url,
    description: description,
    title: title,
    author: author,
    image: image,
    date: Date.now()
  });

  item.save(function (err, doc) {
    var json = {status: 'ok'};
    var code = 200;

    if (err) {
      json.status = 'error';
      json.error = err;
      code = 500;
    }
    else {
      addItemToFeed(doc);
    }

    res.json(json, code);
  });

});

app.use(express.logger("dev"));

var server = app.listen(port, function(){
  console.log('Express server listening on ' + server.address().address + ':' + server.address().port);
});

Item.find({}).sort('-date').execFind(function (err, data) {
  data.forEach(addItemToFeed);
});
