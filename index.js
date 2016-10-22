'use strict';

var mqtt    = require('mqtt');
var request = require('request');
var extend  = require('deep-extend');
var equal   = require('equals');
var config  = require('./config.json');

if (undefined !== process.env['PM2_HOME'])
  process.env['DEBUG'] = '*';

var Debug = require('debug');
var debug = Debug('hue-mqtt-bridge:debug');
var error = Debug('hue-mqtt-bridge:error');
debug.log = console.log.bind(console);

config = extend({
  bridges: [],
  broker: {
    host: 'localhost',
    username: '',
    password: ''
  },
}, config);

if (undefined === config.bridges || !config.bridges.length) {
  error('No Philips Hue bridges are configured. Please configure a bridge and try again.');
  process.exit(1);
}

function slugify(value) {
  return value.toString().toLowerCase().replace(/[ \.\-\/\\]/g, '_').replace(/[^a-z0-9_]/g, '');
}

function startPolling() {
  config.bridges.forEach(function(bridge, index) {
    if (!bridge || undefined === bridge.host || !bridge.host) {
      error('Cannot poll Hue bridge: missing required argument "host"');
      process.exit(1);
    }

    if (undefined === bridge.username || !bridge.username) {
      error('Cannot poll Hue bridge %s: missing required argument "username"', bridge.host);
      process.exit(1);
    }

    bridge.id       = index;
    bridge.interval = bridge.interval || 1000;
    bridge.polling  = false;
    bridge.prefix   = bridge.prefix || 'hue';
    bridge.sensors  = {};
    bridge.skipped  = false;

    debug('Polling Hue bridge %s every %dms', bridge.host, bridge.interval);

    bridge.timer = setInterval(pollSensors, bridge.interval, bridge);
    pollSensors(bridge);
  });
}

function pollSensors(_bridge) {
  var bridge = _bridge;

  if (bridge.polling) {
    if (!bridge.skipped) {
      bridge.skipped = true;
      debug('Polling skipped on Hue bridge %s. Consider raising your polling interval.', bridge.host);
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
      return error('Error polling sensors on Hue bridge %s: %s', bridge.host, err.toString());
    }

    var sensors = body;

    Object.keys(sensors).forEach(function(id) {
      var sensorA = sensors[id];
      var sensorB = bridge.sensors[id];

      if (undefined !== sensorA.error) {
        bridge.polling = false;
        return error('Error polling sensors on Hue bridge %s: %s', bridge.host, sensorA.error.description);
      }

      if (undefined !== sensorB && !equal(sensorA, sensorB)) {
        var nameSlug = slugify(sensorA.name);

        Object.keys(sensorA.state).forEach(function(key) {
          var keySlug = slugify(key);
          var topic = bridge.prefix + '/' + nameSlug + '/' + keySlug;
          var payload = sensorA.state[key];

          debug('%s %s', topic, payload.toString());
          client.publish(topic, payload.toString());
        });
      }

      bridge.sensors[id] = sensorA;
    });

    bridge.polling = bridge.skipped = false;
  });
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
    return error('MQTT Error: %s', err.toString());
});

client.on('close', function(err) {
  if (err)
    return error('MQTT Error: %s', err.toString());
});
