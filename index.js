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
  process.exit(1);
}

function slugify(value) {
  return value.toString().toLowerCase().replace(/[ \.\-\/\\]/g, '_').replace(/[^a-z0-9_]/g, '');
}

function startPolling() {
  config.bridges.forEach(function(bridge, index) {
    if (!bridge || undefined === bridge.host || !bridge.host) {
      console.error('Cannot poll Hue bridge: missing required argument "host"');
      process.exit(1);
    }

    if (undefined === bridge.username || !bridge.username) {
      console.error('Cannot poll Hue bridge %s: missing required argument "username"', bridge.host);
      process.exit(1);
    }

    bridge.id       = index;
    bridge.interval = bridge.interval || 1000;
    bridge.polling  = false;
    bridge.prefix   = bridge.prefix || 'hue';
    bridge.sensors  = {};
    bridge.skipped  = false;

    console.log('Polling Hue bridge %s every %dms', bridge.host, bridge.interval);

    bridge.timer = setInterval(pollSensors, bridge.interval, bridge);
    pollSensors(bridge);
  });
}

function pollSensors(_bridge) {
  var bridge = _bridge;

  if (bridge.polling) {
    if (!bridge.skipped) {
      bridge.skipped = true;
      console.log('Polling skipped on Hue bridge %s. Consider raising your polling interval.', bridge.host);
    }
    return false;
  }

  bridge.polling = true;

  var opts = {
    method: 'GET',
    uri: 'http://' + bridge.host + '/api/' + bridge.username + '/sensors',
    json: true
  };

  request(opts, function(err, res, body) {
    if (err) {
      bridge.polling = false;
      return console.error('Error polling sensors on Hue bridge %s: %s', bridge.host, err.toString());
    }

    var sensors = body;

    Object.keys(sensors).forEach(function(id) {
      var sensorA = sensors[id];
      var sensorB = bridge.sensors[id];

      if (undefined !== sensorA.error) {
        bridge.polling = false;
        return console.error('Error polling sensors on Hue bridge %s: %s', bridge.host, sensorA.error.description);
      }

      if (hasOldState(sensorB) && stateChanged(sensorA, sensorB)) {
        var nameSlug = slugify(sensorA.name);

        Object.keys(sensorA.state).forEach(function(key) {
          var keySlug = slugify(key);
          var topic = bridge.prefix + '/' + nameSlug + '/' + keySlug;
          var payload = sensorA.state[key];

          // console.log('%s %s', topic, payload.toString());
          client.publish(topic, payload.toString());
        });
      }

      bridge.sensors[id] = sensorA;
    });

    bridge.polling = bridge.skipped = false;
  });
}

function hasOldState(sensor) {
  return undefined !== sensor;
}

function stateChanged(sensorA, sensorB) {
  var newState = (sensorA && sensorA.state) ? sensorA.state : undefined;
  var oldState = (sensorB && sensorB.state) ? sensorB.state : undefined;

  return !equal(newState, oldState);
}

// Exit handling to disconnect client
function exitHandler() {
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
    return console.error('MQTT Error: %s', err.toString());
});

client.on('close', function(err) {
  if (err)
    return console.error('MQTT Error: %s', err.toString());
});
