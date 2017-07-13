requirejs.config({
    'baseUrl': 'js/lib'
});

require(['wq/app', 'wq/map', 'wq/locate'], function(app, map, locate) {

var baseurl = window.location.pathname
    .replace("index.html",'')
    .replace(/\/$/,'');

var config = {
    'router': {
        'base_url': baseurl
    },
    'pages': {
        'index': {
            'url': 'index.html',
            'map': true,
            'locate': true
        }
    },
    'map': {
        'bounds': [[44.7, -93.6], [45.2, -92.8]]
    },
    'template': {
        'templates': {}
    }
};

app.use(map);
app.use(locate);
app.use({
    'run': initGPS
});
app.init(config).then(app.jqmInit);

function initGPS($page, routeInfo) {
    var mapId = map.getMapId(routeInfo);
    var locator = locate.locators[mapId];
    if (!locator) {
        return;
    }

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
        $page.find('label[for=gpstest-toggle-internal]').text("GPS");
        $page.find('#gpstest-toggle-internal').val("gps");
        $page.find('label[for=gpstest-toggle-external], #gpstest-toggle-external').hide();
    }
}

});
