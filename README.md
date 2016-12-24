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

### Notes:  
+ Wake-Up is by default set to 1 hour (3600 seconds) on homey.  
The temperature and mode will only be SET when the device Wakes Up.  
If you want to change the Wake-Up Interval,  
you will need to use Steps of 240 seconds.  
Example: 240, 480, 720, 960, etc  
If you do not use a value based on these steps,  
it will use the device's default of 604672 seconds (7 days)

### Supported Languages:
* English
* Dutch (Nederlands)

### Change Log:
**v 1.0.0:**  
Added support Stella Z-Wave  
Comet Z-Wave:  
Update mode support
Updated Read me
Changed error logging
