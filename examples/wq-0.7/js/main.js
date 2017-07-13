requirejs.config({
    'baseUrl': 'js/lib'
});

require(['wq/app', 'wq/locate'], function(app, locate) {

var config = {
        'pages': {}
    },
    templates = {},
    map = L.map('gpstest-edit-map');

app.init(config, templates);
app.jqmInit();

L.Icon.Default.imagePath = "css/lib/images";

map.fitBounds([[44.7, -93.6], [45.2, -92.8]]);
L.tileLayer(
    'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg'
).addTo(map);

var fields = {
    'toggle': $('input[name=toggle]'),
    'latitude': $('input[name=latitude]'),
    'longitude': $('input[name=longitude]'),
    'accuracy': $('input[name=accuracy]'),
    'source': $('input[name=source]')
};

var locator = locate.locator(map, fields);

if (navigator.geolocation.canSetSource) {
    locator.internalStart = function() {
        navigator.geolocation.setSource(
            'internal', locator.gpsStart, locator.onerror
        );
    };
    locator.externalStart = function() {
        navigator.geolocation.setSource(
            'external', locator.gpsStart, locator.onerror
        );
    };
    locator.internalStop = locator.externalStop = locator.gpsStop;
} else {
    $('label[for=gpstest-toggle-internal]').text("GPS");
    $('#gpstest-toggle-internal').val("gps");
    $('label[for=gpstest-toggle-external], #gpstest-toggle-external').hide();
}

});
