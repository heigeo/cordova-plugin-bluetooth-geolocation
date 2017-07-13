var geo = navigator.geolocation;

geo._getCurrentPosition = geo.getCurrentPosition;
geo.getCurrentPosition = function(onSuccess, onError, opts) {
    return geo._getCurrentPosition(function(position) {
        guessSource(position);
        onSuccess(position);
    }, onError, opts);
};

geo._watchPosition = geo.watchPosition;
geo.watchPosition = function(onSuccess, onError, opts) {
    return geo._watchPosition(function(position) {
        guessSource(position);
        onSuccess(position);
    }, onError, opts);
};

geo.hasSource = true;
geo.canSetSource = false;

geo.setSource = function(source, onSuccess, onError) {
    if (!onError) {
        onError = console.error.bind(console);
    }
    onError("Cannot change GPS source on this platform!");
};

function guessSource(position) {
    var source = {}, parts;
    if (position.coords && position.coords.altitude) {
        parts = (position.coords.altitude + '').split('.');
        // On iOS, altitude from an external GPS is rounded down to at most 1
        // decimal place.
        if (parts.length == 1 || parts[1].length == 1) {
            source.type = 'external';
            source.identifier = 'External GPS';
        } else {
            source.type = 'internal';
        }
        source.typeIsGuess = true;
    }
    position.source = source;
}
