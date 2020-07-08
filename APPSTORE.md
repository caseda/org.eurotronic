# Eurotronic Technology
This app adds support for Eurotronic Technology Z-Wave devices in Homey.

## Supported Devices:
+ Stella Z-Wave
+ Comet Z-Wave
+ Spirit Z-Wave

### Device Functions Stella/Comet:
+ Read target temperature (not the manual set temperature)
+ Read last measured temperature (not trigger-able)
+ On every Wake-Up:
  - Read measured temperature (trigger-able)
  - Set target temperature
  - Read/Set modes (Off, Comfortable, Economic, Manual)
  - Set economy target temperature (Setting/Flow)
+ Set manual valve position (flow only)

### Device Functions Spirit:
+ Read/Set target temperature
+ Read/Set measured (room) temperature (set = flow and/or direct association only)
+ Read/Set modes (Off, Comfortable, Economic, Boost, Manual)
+ Set economy target temperature (Setting/Flow)
+ Read/Set (child) protection
+ Set manual valve position (Homey v1: flow only)
+ Error occurred (flow only)

### Notes
**Stella/Comet:**
**The temperature and mode(s) will only be SET when the device Wakes Up.**
Wake-Up is by default set to 1 hour (3600 seconds) on homey.  
If you want to change the Wake-Up Interval, make sure you use Steps of 240 seconds.

### Supported Languages:
* English
* Dutch (Nederlands)

### Change Log:
**v2.1.0:**
- Add battery types for Homey v3's Energy

**v2.0.7:**
- [Spirit] Fix device's measured temperature overwriting the external temperature sensor (when used).
- Update meshdriver to v1.3.3

**v2.0.6:**
- [Comet] Fix crash

**v2.0.5:**
- [Stella] Fix crash
- Add insights for manual value

**v2.0.4:**
- Fix the wrong device (last included) being the device always controlled from flows

**v2.0.3:**
- [Spirit] Fix not being able to send the room temperature
- Added a setting for the Economic temperature

**v2.0.2:**
- Fix rounding errors manual control
- Rewritten internal functions making the app more stable (in particular with multiple devices)

**v2.0.1:**
- [Spirit] Fix external temperature setting not set-able
- Fix set eco temperature flow card
- Update Meshdriver

**v2.0.0:**
- Rewrite to SDKv2
- Update Meshdriver

Rest of the change log can be found [here](https://github.com/caseda/org.eurotronic/blob/master/README.md).
