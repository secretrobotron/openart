var express = require('express');
var knox = require('knox');
var habitat = require('habitat');
var os = require('os');
var path = require('path');
var shortid = require('shortid');
var nunjucks = require('nunjucks');
var fs = require('fs');
var Bitly = require('bitly');

habitat.load();

var env = new habitat();
var s3 = env.get('S3');

var express = require('express');
var app = express();

var port = env.get('PORT');
var hostname = env.get('HOSTNAME') || os.hostname();
var allowedDomains = (env.get('ALLOWED_DOMAINS') || '').split(' ');
var allowedIPs = (env.get('ALLOWED_IPS') || '').split(' ');

var knoxClient = knox.createClient({
  key: s3.key,
  secret: s3.secret,
  bucket: s3.bucket
});

app.use(express.bodyParser());

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

function sendKnoxHTMLRequest (filename, data, callback) {
  var knoxReq = knoxClient.put(filename, {
    'x-amz-acl': 'public-read',
    'Content-Length': Buffer.byteLength(data, 'utf8'),
    'Content-Type': 'text/html'
  });

  knoxReq.on('response', callback);

  knoxReq.end(data);
}

var bitlyConfig = env.get('BITLY');
var bitly = new Bitly(bitlyConfig.user, bitlyConfig.key);

var nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../examples')));
nunjucksEnv.express(app);

var publishUrl = 'http://' + s3.bucket + '.s3.amazonaws.com'

app.use(express.static(path.join(__dirname, '../')));

app.post('/post', function (req, res) {
  if (allowedIPs.indexOf(req.connection.remoteAddress) === -1) {
    res.send('No.', 500);
    return;
  }

  var inputData = req.body.data;

  if (!inputData) {
    res.send('No.', 500);
    return;
  }

  var filename = shortid.generate();
  var longUrl = 'http://s3.amazonaws.com/' + s3.bucket + '/' + filename;

  sendKnoxHTMLRequest(filename, inputData, function (knoxRes) {
    if (200 == knoxRes.statusCode) {
      bitly.shorten(longUrl, function(err, response) {
        var url = (err || response.status_code !== 200) ? longUrl : response.data.url;
        res.json({url: url}, 200);
      });
    }
    else {
      res.json({error: 'Couldn\'t save to S3'}, 500);
    }
  });
});

app.use(express.logger("dev"));

var server = app.listen(port, function(){
  console.log('Express server listening on ' + server.address().address + ':' + server.address().port);
});