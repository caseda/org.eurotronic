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
  - Set economy target temperature (Setting/flow)
+ Set manual valve position (flow only)

### Device Functions Spirit:
+ Read/Set target temperature
+ Read/Set measured (room) temperature (set = flow and/or direct association only)
+ Read/Set modes (Off, Comfortable, Economic, Boost, Manual)
+ Set economy target temperature (setting/flow)
+ Read/Set (child) protection
+ Set manual valve position (flow only)
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
- [Spirit] Fix device's measured temperature overwriting the external temperature sensor value (when used).
- Add battery types for Homey v3's Energy
- Update meshdriver

**v2.0.6:**
- [Comet] Fix crash

**v2.0.5:**
- [Stella] Fix crash
- [Spirit] (Re)set measured temperature on change of external temperature setting
- Add insights for manual value

**v2.0.4:**
- Fix the wrong device (last included) being the device always controlled from flows

**v2.0.3:**
- [Spirit] Fix not being able to send the room temperature
- Added a setting for the Economic temperature

**v2.0.2:**
- Fix rounding errors manual control
- Rewritten internal functions making the app more stable (in particular with multiple devices)
- Fixed `$deg;C` special character which didn't work, to normal `°C`

**v2.0.1:**
- [Spirit] Fix external temperature setting not set-able
- Fix set eco temperature flow card
- Update Meshdriver to v1.2.30
- Fix whitespacing

**v2.0.0:**
- Rewrite to SDKv2
- Update Meshdriver to v1.2.28

**v1.2.1:**
- [Spirit] Fix default temperature reporting, normal default is too high.
- [Spirit]: Fix a few text errors.
- [Spirit]: Added id's for (future) firmware updates of the spirit.

**v1.2.0:**
- Add support Spirit Z-Wave
- Fixed temperature ranges of Stella and Comet thermostatic
- Fixed "manual position" value not being inserted in the global token
- Update Z-Wave driver to 1.1.9

**v1.1.3:**
- Fix set economic temperature bug.

**v1.1.1 & 1.1.2:**
- Minor fixes

**v1.1.0:**
- Add support for manual position control (re-pair needed for full support)
- Update Z-Wave driver to 1.1.8
- A lot of code improvements

**v1.0.0:**  
- Added support Stella Z-Wave
- [Comet] Update mode support
- [Comet] Updated Read me
- [Comet] Changed error logging
