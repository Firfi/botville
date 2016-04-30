'use strict';

var EventEmitter = require('events').EventEmitter;

var disabled = (process.env['DISABLED'] === 'true');

var bot = disabled ? new EventEmitter() : require('./bot.js');

if (!process.env['WEB']) return;

var express = require('express');
var _ = require('underscore');

var app = express();

var config = {};
try {
  var args = process.argv.slice(2);
  config = _.find(require('./config.json').accounts, function(a) {
    return a.id === Number(args[0]);
  });
} catch (e) {
}

app.use(express.static(__dirname + '/static'));
//app.get('/', function(req, res) {
//  res.render('static/index.html');
//});


var port = process.env.PORT || 5000; // Use the port that Heroku provides or default to 5000
var server = app.listen(port, function() {
  console.log("Express server listening on port %d in %s mode", port, app.settings.env);
});

if (!disabled) {
  console.warn('non disabled');
  var MongoClient = require('mongodb').MongoClient;
  var mongoUrl = 'mongodb://' + (process.env['MONGODB_LOGIN'] || config.mongodbLogin) + ':' +
    (process.env['MONGODB_PASSWORD'] || config.mongodbPassword) + '@ds029831.mongolab.com:29831/heroku_app21019611';

  var emitter = new EventEmitter();

//io.configure(function () {
//  io.set("transports", ["xhr-polling"]);
//  io.set("polling duration", 10);
//});



  var io = require('socket.io').listen(server);

  MongoClient.connect(mongoUrl, function(err, db) {

    if (err) console.error(err);

    db.collection('gmessages', function(err, gmessages) {

      if (err) return console.error(err);

      gmessages.ensureIndex( { id: 1 }, { unique: true, dropDups: true }, function(err) {
        if (err) return console.error(err);

        bot.on('chat', function(msg) {
          console.warn('boton chat 2');
          gmessages.insert(msg, function(err) {
            if (err) return console.error(err);
            else {
              if (!msg) {
                console.warn('what the fuck')
              }
              console.warn('emitting chat 1');
              emitter.emit('chat', msg);
            }
          });
        });


        io.sockets.on('connection', function (socket) {

          var callback = function(m) {
            console.warn('socket emit chat', m);
            if (m) socket.emit('chat', m);
          };

          var page = function(n) {
            var PAGE = 200;
            if (!n) n = 0;
            gmessages.find().sort({timestamp: -1}).skip(PAGE * n).limit(PAGE).toArray(function(err, ms) {
              if (err) return console.error(err);
              ms = ms.filter(function(m) {
                if (!m) {
                  console.warn('what the fuck 2 ' + m);
                  return false;
                } else return true;
              });
              ms.reverse();
              callback(ms);
            });
          };

          socket.on('page', page);

          var createMessage = function(message) {
            console.warn(message)
            bot.emit('createMessage', message);
            return false;
          };

          socket.on('createMessage', createMessage);

          emitter.on('chat', callback);

          socket.on('close', function () {
            emitter.removeListener('chat', callback);
          });
        });
      });



    });



  });
}



