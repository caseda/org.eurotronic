# Eurotronic Technology

This app adds support for Eurotronic Technology Z-Wave devices in Homey.

## Supported Devices:
+ Comet Z-Wave
  - Read target temperature (no manual set temperature)
  - Read measured temperature once (not trigger-able)
  - Default Wake-Up time set to 3600 seconds (1 hour)  
  - On every Wake-Up:
    - Read measured temperature (trigger-able)
    - Set target temperature
    - Set economy target temperature (Flow Only)
    - Set/Read modes
      - Off
      - Comfort
      - Economy

### Notes
+ Until it is possible to change the values of the modes they work like this:
  - In Homey => On Comet
  - Cool => Off
  - Heat => Comfort
  - Auto => Economy
  
+ Wake-Up is by default set to **1 hour** on homey.  
This is done so you will not have to manually wake up the device.  
It needs to wake-up before it applies the target temperature and mode.  
This will cost more battery life.  
If you don't like this, you can change the wake-up interval in the settings.

### Supported Languages:
* English
* Dutch (Nederlands)
