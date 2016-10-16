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
      "prefix": "hue/sensor",
      "ignore": {
        "buttonevent": [1000, 1001, 2000, 2001, 3000, 3001, 4000, 4001]
      }
    }
  ]
}
```
