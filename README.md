# Philips Hue Sensor MQTT Bridge

This should be compatible with multiple Hue bridges, but it has only been tested
with one. Also, this has only been tested with Hue Dimmer.

I have noticed the best performance when running the polling interval at 500ms.

If you have any issues, please post them on
[GitHub](https://github.com/dale3h/hue-mqtt-bridge/issues).

## Configuration

```json
{
  "broker": {
    "host": "localhost",
    "username": "XXXXXXXX",
    "password": "XXXXXXXX"
  },
  "bridges": [
    {
      "host": "XXX.XXX.XXX.XXX",
      "username": "XXXXXXXX",
      "interval": 1000,
      "prefix": "hue"
    }
  ]
}
```

## Installation

### A ***huge*** thank you goes out to @LaurensBot for writing this guide.

The instructions are based on the Raspberry Pi and assume that you already have
the following installed:

  * Node.js
  * Home Assistant
  * `git`
  * `mosquitto` MQTT broker

1. Create a parent folder for hue-mqtt-bridge:

  ```
  mkdir /home/pi/node
  cd /home/pi/node
  ```

1. Clone the git repository:

  ```
  git clone git://github.com/dale3h/hue-mqtt-bridge.git
  cd hue-mqtt-bridge
  ```

1. Install dependencies (do not run as root):

  ```
  npm install
  ```

1. Create the config file and edit it to your liking:

  ```
  cp config.sample.json config.json
  nano config.json
  ```

  You can find the username in the Home Assistant directory in a file named `phue.conf`. It is the long string of random characters.

1. Make `hue-mqtt-bridge` start at boot:

  ```
  sudo npm install -g pm2
  pm2 startup systemd
  ```

  This will give you a command that includes `sudo` -- run that command.

1. Time to run `hue-mqtt-bridge`:

  ```
  ./bin/hue-mqtt-bridge
  ```

  If no errors are shown, all should be working.

1. If no errors are shown stop (`Ctrl+C`) the process and run:

  ```
  pm2 start index.js --name hue-mqtt-bridge
  pm2 save
  ```

1. The topics in MQTT start with `hue` by default, so to see the output run:

  ```
  mosquitto_sub -h localhost -p 1883 -u YOUR_MQTT_USERNAME -P YOUR_MQTT_PASSWORD -v -t '#'
  ```

  Click a button on your Hue Dimmer or Hue Tap, or trigger your Hue Motion.

1. Add it to Home Assistant

  Running the above command showed the following output when pressing a button:

  ```
  hue/hue_tap_tap1/buttonevent 34
  ```

  The topic will be different so adjust the trigger below with your topic:

  ```
  automation:
    - alias: hue_tap_button_1
      trigger:
        - platform: mqtt
          topic: hue/hue_tap_tap1/buttonevent
          payload: '34'
      action:
        - service: homeassistant.turn_on
          entity_id: script.todosomething
  ```
