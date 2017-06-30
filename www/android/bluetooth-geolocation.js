var geo = navigator.geolocation,
    exec = require('cordova/exec'),
    utils = require('cordova/utils'),
    listpicker = window.plugins.listpicker,
    currentSource,
    GPS = require('./gps'),
    Coordinates = require('./Coordinates'),
    Position = require('./Position'),
    PositionError = require('cordova-plugin-geolocation.PositionError'),
    UNCATEGORIZED = 7936;

geo._getCurrentPosition = geo.getCurrentPosition;
geo._watchPosition = geo.watchPosition;
geo._clearWatch = geo.clearWatch;

geo.hasSource = true;
geo.canSetSource = true;

geo.setSource = function(source, onSuccess, onError) {
    if (!onSuccess) {
        onSuccess = function(sourceInfo) {
            console.info("GPS source set to " + sourceInfo.type);
        }
    }
    if (!onError) {
        onError = console.error.bind(console);
    }
    if (geo.setSource[source]) {
        geo.setSource[source](onSuccess, onError);
    } else {
        onError("Unknown source type: " + source);
    }
};

geo.setSource.internal = function(onSuccess, onError) {
    setMethods(initInternalGPS());
    onSuccess({
        'type': 'internal'
    });
    bluetoothSerial.isConnected(function() {
        bluetoothSerial.disconnect();
    });
};

geo.setSource.external = function(onSuccess, onError) {
    if (!onError) {
        onError = console.error.bind(console);
    }
    bluetoothSerial.list(function(list) {
        var devices = list.filter(function(device) {
            return device['class'] == UNCATEGORIZED;
        });
        if (devices.length == 1) {
            setDevice(devices[0]);
        } else if (devices.length > 1) {
            chooseDevice(devices);
        } else if (list.length == 1) {
            setDevice(list[0]);
        } else if (list.length > 0) {
            chooseDevice(list);
        } else {
            onError("No paired devices found.");
        }
    }, onError);

    function setDevice(device) {
        bluetoothSerial.isConnected(function() {
            bluetoothSerial.disconnect(testConnection, onError);
        }, testConnection);
        function testConnection() {
            bluetoothSerial.connect(device.id, function() {
                setMethods(initExternalGPS(device));
                onSuccess({
                    'type': 'external',
                    'identifier': device.name + ' (' + device.id + ')'
                });
                bluetoothSerial.disconnect();
            }, onError);
        }
    }

    function chooseDevice(devices) {
        var opts = {
            'title': 'Select Bluetooth Device',
            'selectedValue': devices[0].id,
            'items': devices.map(function(device) {
                return {
                    'text': device.name,
                    'value': device.id
                };
            })
        };
        listpicker.showPicker(opts, function(devId) {
            setDevice(devices.filter(function(device) {
                return device.id == devId;
            })[0]);
        }, function() {
            onError("No device selected.");
        });
    }
};

geo.setSource('internal');

geo.showSourcePicker = function(title) {
    if (!title) {
        title = "Select Location Source";
    }
    var opts = {
        'title': title,
        'items': [{
            'value': 'internal',
            'text': 'Internal GPS / Services'
        }, {
            'value': 'external',
            'text': 'External GPS'
        }],
        'selectedValue': (currentSource && currentSource.type || 'internal')
    };
    listpicker.showPicker(opts, function(sourceType) {
        geo.setSource(sourceType, function(source) {
            currentSource = source;
        }, function(error) {
            geo.showSourcePicker("Select Location Source\nError: " + error);
        });
    });
};


function setMethods(obj) {
    Object.keys(obj).forEach(function(key) {
        geo[key] = obj[key];
    });
}


function initInternalGPS() {
    return {
        'getCurrentPosition': function(onSuccess, onError, opts) {
            return geo._getCurrentPosition(function(position) {
                position.source = {
                   'type': 'internal',
                   'typeIsGuess': false
                };
                onSuccess(position);
            }, onError, opts);
        },
        'watchPosition': function(onSuccess, onError, opts) {
            return geo._watchPosition(function(position) {
                position.source = {
                   'type': 'internal',
                   'typeIsGuess': false
                };
                onSuccess(position);
            }, onError, opts);
        },
        'clearWatch': geo._clearWatch
    };
}

function initExternalGPS(device) {
    var gps = new GPS(),
        callbacks = {};

    gps.on('data', onUpdate);

    function getCurrentPosition(onSuccess, onError, opts) {
        var cbid = createCallback(function(position) {
            onSuccess(position);
            removeCallback(cbid);
        }, onError);
    }

    function watchPosition(onSuccess, onError, opts) {
        return createCallback(onSuccess, onError);
    }

    function createCallback(onSuccess, onError) {
        var cbid = utils.createUUID();
        exec(function() {
            _createCallback(cbid, onSuccess, onError);
        }, function() {
            if (onError) {
                onError(new PositionError(
                    PositionError.PERMISSION_DENIED,
                    "No location permission"
                ));
            }
        }, "Geolocation", "getPermission", []);
        return cbid;
    }

    function _createCallback(cbid, onSuccess, onError) {
        callbacks[cbid] = onSuccess;
        bluetoothSerial.isConnected(function() {}, function() {
            bluetoothSerial.connect(device.id, function() {
                bluetoothSerial.subscribe('\n', function(message) {
                    gps.update(message);
                }, onError);
            }, onError);
        });
    }

    function removeCallback(cbid) {
        delete callbacks[cbid];
        if (Object.keys(callbacks).length == 0) {
            bluetoothSerial.disconnect();
        }
    }

    var activeType = null;
    function onUpdate(nmea) {
        if (nmea.type != 'RMC' && nmea.type != 'GGA') {
            return;
        }

        // Wait until second NMEA message before triggering callback
        // (important if both RMC and GGA are active)
        if (!activeType) {
            if (activeType === null) {
                activeType = false;
                return;
            } else {
                activeType = nmea.type;
            }
        }

        if (nmea.type != activeType) {
            return;
        }

        if (!gps.state.lat || !gps.state.lon || !gps.state.time) {
            return;
        }

        var position = new Position(
            {
                'latitude': gps.state.lat,
                'longitude': gps.state.lon,
                'altitude': gps.state.alt,
                'heading': gps.state.heading,
                // Convert knots to m/s
                'velocity': gps.state.speed && gps.state.speed * 0.514444,
                
                // Guess 7.8 meters 95% interval as base accuracy
                'accuracy': gps.state.hdop && gps.state.hdop * 4,
                'verticalAccuracy': gps.state.vdop && gps.state.vdop * 4 // ?
            },
            gps.state.time.getTime()
        );

        position.source = {
            'type': 'external',
            'typeIsGuess': false,
            'identifier': device.name + " (" + device.id + ")"
        };

        Object.keys(callbacks).forEach(function(cbid) {
            callbacks[cbid](position);
        });
    }

    function clearWatch(cbid) {
        removeCallback(cbid);
    }

    return {
        'getCurrentPosition': getCurrentPosition,
        'watchPosition': watchPosition,
        'clearWatch': clearWatch
    };
};
