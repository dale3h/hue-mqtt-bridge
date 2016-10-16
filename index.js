'use strict';

var mqtt    = require('mqtt');
var request = require('request');
var extend  = require('deep-extend');
var equal   = require('equals');
var config  = require('./config.json');

config = extend({
  bridges: [],
  broker: {
    host: 'localhost',
    username: '',
    password: ''
  },
}, config);

if (undefined === config.bridges || !config.bridges.length) {
  console.error('No Philips Hue bridges are configured. Please configure a bridge and try again.');
  process.exit();
}

function slugify(value) {
  return value.toString().toLowerCase().replace(/[ -\/\\]/g, '_').replace(/[^a-z0-9_]/g, '');
}

function startPolling() {
  console.log('Setting up polling timer(s)');

  config.bridges.forEach(function(bridge, index) {
    bridge.interval = bridge.interval || 1000;
    bridge.prefix = bridge.prefix || 'hue/sensor';
    bridge.id = index;
    bridge.sensors = {};

    console.log('Polling bridge %s every %dms', bridge.host, bridge.interval);

    bridge.timer = setInterval(pollSensors, bridge.interval, bridge);
    pollSensors(bridge);
  });
}

function pollSensors(_bridge) {
  var bridge = _bridge;

  if (!bridge || undefined === bridge.host || !bridge.host)
    return console.error('[hue]', 'Invalid bridge:', bridge);

  if (undefined === bridge.pollCount)
    bridge.pollCount = 0;
  bridge.pollCount++

  var opts = {
    method: 'GET',
    uri: 'http://' + bridge.host + '/api/' + bridge.username + '/sensors',
    json: true
  };

  request(opts, function(err, res, body) {
    if (err)
      return console.error('[hue]', err.toString());

    var sensors = body;

    Object.keys(sensors).forEach(function(id) {
      var sensorA = sensors[id];
      var sensorB = bridge.sensors[id];

      if (undefined !== sensorA.error)
        return console.error('[hue] Error polling sensors on bridge %s:', bridge.host, sensorA.error.description);

      if (undefined !== sensorB && !equal(sensorA, sensorB)) {
        var nameSlug = slugify(sensorA.name);

        Object.keys(sensorA.state).forEach(function(key) {
          if ('lastupdated' === key)
            return;

          var keySlug = slugify(key);
          var topic = bridge.prefix + '/' + nameSlug + '/' + keySlug;
          var payload = sensorA.state[key];

          var ignoreState = false;

          try {
            ignoreState = bridge.ignore[key].indexOf(parseInt(payload, 10)) !== -1;
          } catch (err) {
            // If the statement above errors, we want to publish the change
          }

          if (!ignoreState) {
            console.log('[mqtt]', topic, payload.toString());
            client.publish(topic, payload.toString());
          }
        });
      }

      bridge.sensors[id] = sensorA;
    });
  });
}

// Exit handling to disconnect client
function exitHandler(err) {
  if (err)
    return console.error(err.toString());

  client.end();
  process.exit();
}

// Disconnect client when script exits
process.on('exit', exitHandler);
process.on('SIGINT', exitHandler);

var client = mqtt.connect(config.broker);

client.on('connect', function() {
  startPolling();
});

client.on('error', function(err) {
  if (err)
    return console.error('[mqtt]', err.toString());
});

client.on('close', function(err) {
  if (err)
    return console.error('[mqtt]', err.toString());
});
