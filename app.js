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

var DATABASE_RETRIEVE_LIMIT = 75;
var FEED_ITEM_LIMIT = 100;

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

var feed;

var rssOutputString, atomOutputString;

function createFeed () {
  return new Feed({
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
}

function retrieveFeedItemsFromDatabase (callback) {
  Item.find({}).sort('-date').limit(DATABASE_RETRIEVE_LIMIT).execFind(callback);
}

function createFeedAndFillIt (callback) {
  feed = createFeed();
  retrieveFeedItemsFromDatabase(function (err, data) {
    data.forEach(refreshFeed);
    callback && callback();
  });
}

function refreshFeed (item) {

  function addThisItem () {
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
  }

  function createStrings () {
    rssOutputString = feed.render('rss-2.0');
    atomOutputString = feed.render('atom-1.0');
  }

  if (feed.items.length > FEED_ITEM_LIMIT) {
    createFeedAndFillIt();
    createStrings();
  }
  else {
    addThisItem();
    createStrings();
  }

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
    else if (el === '*') {
      resp.header('Access-Control-Allow-Origin', '*'); 
    }
  });

  resp.header('Access-Control-Allow-Methods', 'GET POST');
  resp.header('Access-Control-Allow-Headers', 'Content-Type');

  next();
};

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: env.get('SESSION_SECRET')}));
app.use(allowCorsRequests);

app.get(feedConfig.rss_path, function (req, res) {
  res.send(rssOutputString, 200);
});

app.get(feedConfig.atom_path, function (req, res) {
  res.send(atomOutputString, 200);
});

app.get('/test', function (req, res) {
  res.send('' +
    '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head><title>test</title></head>\n' +
    '<body>\n' +
    '<form action="/post" method="post">\n' +
    '<input type="text" name="title" placeholder="title">\n' +
    '<input type="text" name="description" placeholder="description">\n' +
    '<input type="text" name="url" placeholder="url">\n' +
    '<input type="text" name="image" placeholder="image">\n' +
    '<input type="text" name="author" placeholder="author">\n' +
    '<input type="submit">\n' +
    '</form>\n' +
    '</body>\n' +
    '</html>\n' +
    '', 200);
});

app.options('/post', function (req, res) {
  res.send('', 200);
});

app.post('/post', function (req, res) {
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
      refreshFeed(doc);
    }

    res.json(json, code);
  });

});

createFeedAndFillIt();

app.use(express.logger("dev"));

var server = app.listen(port, function(){
  console.log('Express server listening on ' + server.address().address + ':' + server.address().port);
});
