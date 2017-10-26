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
  - Set economy target temperature (Flow Only)
+ Set manual valve position (flow only)

### Device Functions Spirit:
+ Read/Set target temperature
+ Read/Set measured (room) temperature (set = flow and/or direct association only)
+ Read/Set modes (Off, Comfortable, Economic, Boost, Manual)
+ Set economy target temperature (flow only)
+ Read/Set (child) protection
+ Set manual valve position (flow only)

### Notes
**Stella/Comet:**
**The temperature and mode(s) will only be SET when the device Wakes Up.**
Wake-Up is by default set to 1 hour (3600 seconds) on homey.  
If you want to change the Wake-Up Interval, make sure you use Steps of 240 seconds.

### Supported Languages:
* English
* Dutch (Nederlands)

### Change Log:
**v1.2.0:**
Add support Spirit Z-Wave  
Fixed temperature ranges of Stella and Comet thermostatic  
Fixed "manual position" value not being inserted in the global token  
Update Z-Wave driver to 1.1.9

**v1.1.3:**
Fix set economic temperature bug.

**v1.1.1 & 1.1.2:**
Minor fixes

**v1.1.0:**
Add support for manual position control (re-pair needed for full support)  
Update Z-Wave driver to 1.1.8  
A lot of code improvements

**v1.0.0:**
Added support Stella Z-Wave  
Comet Z-Wave:  
Update mode support  
Updated Read me  
Changed error logging

### Donate:
If you like the work that I have done, and loved the magic.  
Maybe you can think about filling my magic meter again:  
[![Paypal Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CH7AVGUY9KEQJ)
