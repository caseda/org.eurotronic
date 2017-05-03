# Eurotronic Technology
This app adds support for Eurotronic Technology Z-Wave devices in Homey.

## Supported Devices:
+ Stella Z-Wave
+ Comet Z-Wave

### Device Functions:
+ Read target temperature (not the manual set temperature)
+ Read last measured temperature (not trigger-able)
+ On every Wake-Up:
  - Read measured temperature (trigger-able)
  - Set target temperature
  - Set economy target temperature (Flow Only)
  - Set/Read modes
+ Set manual valve position (Flow Only)

### Notes:
**The temperature and mode(s) will only be SET when the device Wakes Up.**
Wake-Up is by default set to 1 hour (3600 seconds) on homey.  
If you want to change the Wake-Up Interval, make sure you use Steps of 240 seconds.

### Supported Languages:
* English
* Dutch (Nederlands)

### Change Log:
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
