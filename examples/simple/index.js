(function() {
var toggle = document.getElementById('toggle'),
    settings = document.getElementById('settings'),
    output = document.getElementById('output'),
    watchId = null;

toggle.onclick = function() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        toggle.innerHTML = 'Start GPS';
        watchId = null;
    } else {
        toggle.innerHTML = 'Stop GPS';
        watchId = navigator.geolocation.watchPosition(
            onSuccess,
            onError
        );
    }
};

if (navigator.geolocation.hasSource) {
    if (navigator.geolocation.canSetSource) {
        settings.onclick = function() {
            navigator.geolocation.showSourcePicker();
        };
    } else {
        settings.disabled = true;
    }
} else {
    settings.disabled = true;
}

function onSuccess(pos) {
    var html = "<dl>";
    for (var key in pos) {
        var val = pos[key];
        html += "<dt>" + key + "</dt><dd>";
        if (typeof val == "object") {
            for (var vk in val) {
                html += vk + ": " + val[vk] + "<br>";
            }
        } else {
            html += val;
        }
        html += "</dd>";
    }
    html += "</dl>";
    output.innerHTML = html;
}

function onError(error) {
    output.innerHTML = error.message;
}

})();
