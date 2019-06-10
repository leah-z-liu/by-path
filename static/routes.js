mapboxgl.accessToken = 'pk.eyJ1IjoibGVhaGxpdTc3OSIsImEiOiJjanV6MnVkYW0wMTBmNGVtM2poMndwMjdnIn0.wrnrUFRy7LuvPTnzY9PcGA';


const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/leahliu779/cjw5ehrfg2s3y1cnryib5ekzx',
  center: [-122.4194, 37.7749],
  zoom: 13
});

const formattedRoute = inputCleanup(route);
const formattedId = inputCleanup(r_id);

//load heatmap
map.on('load', function(){

    getCoords(formattedRoute);

    $.getJSON('/api/incidents', response => {
        map.addSource('crimes', {
        type: 'geojson',
        data: response,
        });

        // add heatmap layer
        map.addLayer({
            id: 'crimes-heat',
            type: 'heatmap',
            source: 'crimes',
            maxzoom: 15,
            layout: {
                'visibility': 'visible',
            },
            paint: {
                // increase weight as incident code increases
                "heatmap-weight": [
                    "interpolate",
                    ["linear"],
                    ["get", "incident_code"],
                    0, 0,
                    30, 1
                ],
                // increase intensity as zoom level increases
                'heatmap-intensity': {
                    stops: [
                        [11, 1],
                        [15, 3]
                    ]
                },
                // assign color values be applied to points depending on their density
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(236,222,239,0)',
                    0.2, '#B9B0FF',
                    0.4, '#9486EB',
                    0.6, '#8A73FF',
                    0.8, '#5F32FF'
                ],
                // increase radius as zoom increases
                'heatmap-radius': {
                    stops: [
                        [11, 15],
                        [15, 20]
                    ]
                },
                // decrease opacity to transition into the circle layer
                'heatmap-opacity': {
                    default: 1,
                    stops: [
                        [14, 1],
                        [15, 0]
                    ]
                },
            }
        }, 'waterway-label');

        // add the circle layer
        map.addLayer({
            id: 'crimes-point',
            type: 'circle',
            source: 'crimes',
            minzoom: 15,
            paint: {
                // increase radius of circle as zoom level and dbh value increases
                'circle-radius': {
                    property: 'incident_code',
                    type: 'exponential',
                    stops: [
                        [{ zoom: 15, value: 1 }, 5],
                        [{ zoom: 15, value: 62 }, 10],
                        [{ zoom: 22, value: 1 }, 20],
                        [{ zoom: 22, value: 62 }, 50],
                    ]
                },
                "circle-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "incident_code"],
                    1, "#B5F7F5",
                    2, "#55ADAA",
                    3, "#FFB289",
                    4, "#FA905C",
                    5, "#AD3900"
                ], 
                'circle-stroke-color': 'white',
                'circle-stroke-width': 1,
                'circle-opacity': {
                    stops: [
                        [14, 0],
                        [15, 1]
                    ]
                }
            }
        }, 'waterway-label');

        map.on('mouseenter', 'crimes-point', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            popup.setLngLat(e.features[0].geometry.coordinates)
                 .setHTML('<b>Incident Category:</b> ' + e.features[0].properties.incident_category)
                 .addTo(map);
        });
        
        map.on('mouseleave', 'crimes-point', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        })
    })
})

function getCoords(fRoute) {

    let coords = {
        coordinates: [],
        type: 'LineString'
    }
    
    const waypoints = fRoute.split(',');
    for (let waypoint of waypoints) {
        const lngLat = waypoint.split(' ');
        coords.coordinates.push(lngLat);
    }
    addRoute(coords);
}

// adds the route as a layer on the map
function addRoute(coords) {

    map.addLayer({
    "id": "route",
    "type": "line",
    "source": {
        "type": "geojson",
        "data": {
        "type": "Feature",
        "properties": {},
        "geometry": coords
        }
    },
    "layout": {
        "line-join": "round",
        "line-cap": "round"
    },
    "paint": {
        "line-color": "#3b9ddd",
        "line-width": 10,
        "line-opacity": 0.8
    }
    });

    // show options to get direction or delete current route
    map.on('click', "route", () => {
        $('#routeModal').modal('show');
    })

    // delete route on click
    $('#del-route').on('click', () => {
        $.post('/deleteroute/' + formattedId)
        .done(
            () => {
                location.reload(true);
            }) 
        .fail(function(jqxhr, settings, ex) {
            alert('Error:', ex);
        })
    })

    // get direction on click
    $('#get-nav').on('click',() => {
        $('#routeModal').modal('hide');
        $('#clear-nav').show();
        getNav(coords.coordinates);
        fitBounds(coords.coordinates);
    })
}

// get navigation for route
function getNav(coords) {

    // set profile
    const profile = 'walking';
    const radius = [];
    // set radius for each point
    coords.forEach( coord => {
        radius.push(5);
    });

    const url = 'https://api.mapbox.com/matching/v5/mapbox/' + profile + '/' + coords.join(';') + '?geometries=geojson&radiuses=' + radius.join(';') + '&steps=true&access_token=' + mapboxgl.accessToken;
    console.log(url);
    $.getJSON(url, jsonResponse => {
        // add turn-by-turn instruction
        const all_legs = jsonResponse.matchings[0].legs;
        for (let i = 0; i < all_legs.length; i++) {
            let instr = all_legs[i].steps[0].maneuver.instruction;
            $('.navigation').append('<p>' + instr + '</p>');
        }
        $('.navigation').show();
    })
}

$('#clear-nav').on('click', () => {
    clearNav();
})
// clear current navigation and display back all routes
function clearNav() {
    map.setZoom(12);
    $('.navigation').text('');
    $('.navigation').hide();
    $('#clear-nav').hide();
}

// fit bounds to the route
function fitBounds(coords) {
    // Pass the first coordinates in the LineString to `lngLatBounds` &
    // wrap each coordinate pair in `extend` to include them in the bounds
    // result. 
    let bounds = coords.reduce((bounds, coord) => {
        return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coords[0], coords[0]));

    map.fitBounds(bounds, {
        padding: 20
    })
}

// turn input string into formatted array
function inputCleanup(str) {

    const formatted = str.replace(/[\[\]\"]/g, '');
    
    return formatted;
}

