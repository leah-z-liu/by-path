mapboxgl.accessToken = 'pk.eyJ1IjoibGVhaGxpdTc3OSIsImEiOiJjanV6MnVkYW0wMTBmNGVtM2poMndwMjdnIn0.wrnrUFRy7LuvPTnzY9PcGA';


const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/leahliu779/cjw5ehrfg2s3y1cnryib5ekzx',
  center: [-122.4194, 37.7749],
  zoom: 11
});

// add search tool plugins
const start = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: "Choose your starting point",
});

const end = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: "Choose your destination",
});

// add geolocaion marker
const marker = new mapboxgl.Marker({
    draggable: true
})

// initialize tooltips
$(() => {
    $('[data-toggle="tooltip"]').tooltip()
})

// add geolocate tool
$('#get-location').on('click', () => {
    navigator.geolocation.getCurrentPosition((position) => {
        coordinates = position.coords.longitude + ',' + position.coords.latitude
        $('#hiddenInfo').attr('data-start', coordinates);
        // set flyto animation
        map.flyTo({
            center: [
                position.coords.longitude,
                position.coords.latitude
            ],
            zoom:15
        })
        // add draggable marker
        marker.setLngLat([position.coords.longitude, position.coords.latitude])
        .addTo(map);

        marker.on('dragend', () => {
            const lnglat = marker.getLngLat();
            $('#hiddenInfo').attr('data-start', lnglat.lng + ',' + lnglat.lat);
        });
    })
})

// add draw tool plugin
const draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
        line_string: true,
        trash: true
    },
    styles: [
        // ACTIVE (being drawn)
        // line stroke
            {
            "id": "gl-draw-line",
            "type": "line",
            "filter": ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "#3b9ddd",
                "line-dasharray": [0.2, 2],
                "line-width": 4,
                "line-opacity": 0.7
            }
        },
        // vertex point halos
        {
            "id": "gl-draw-polygon-and-line-vertex-halo-active",
            "type": "circle",
            "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
            "paint": {
                "circle-radius": 10,
                "circle-color": "#FFF"
            }
        },
        // vertex points
        {
            "id": "gl-draw-polygon-and-line-vertex-active",
            "type": "circle",
            "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
            "paint": {
                "circle-radius": 6,
                "circle-color": "#3b9ddd",
            }
        },
    ]
});

// add popup 
let popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});

// add location control to control panel
map.addControl(end, 'top-left');

// add the draw tool to the map
map.addControl(draw, 'bottom-left');


// save destination information
end.on('result', function (evt) {
    const response = evt.result;
    const coords = response.center.join(',');
    $('#hiddenInfo').attr('data-destination', coords);
    $('#get-direction').show();
})

// save starting point information
$('#get-start').on('click', () => {
    marker.remove();
    map.addControl(start, 'top-left');
    start.on('result', function (evt) {
        const response = evt.result;
        const coords = response.center.join(',');
        $('#hiddenInfo').attr('data-start', coords);
    })
})


// load data and base map
map.on('load', function(){

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

// get direction on click
$('#get-direction').on('click', () => {
    removeRoute();
    const startCoords = $('#hiddenInfo').data('start');
    const endCoords = $('#hiddenInfo').data('destination');
    const route = [startCoords, endCoords].join(';');
    if (!startCoords || !endCoords) {
        alert("Please set both starting point and destination.")
    } else {
        $('#clear-route').show();
        getMatch(route);
    }
})


// remove route when click remove route button
$('#clear-route').on('click', removeRoute);

// use the coordinates you just drew to make your directions request
function updateRoute() {
    removeRoute(); // overwrite any existing layers
    var data = draw.getAll();
    var lastFeature = data.features.length - 1;
    var coords = data.features[lastFeature].geometry.coordinates;
    var newCoords = coords.join(';')
    getMatch(newCoords);
}

// make a directions request
function getMatch(e) {
    // set default profile to walking
    let profile = 'walking/';
    const url = 'https://api.mapbox.com/directions/v5/mapbox/' + profile + e +'?geometries=geojson&steps=true&&banner_instructions=true&&access_token=' + mapboxgl.accessToken;

    $.getJSON(url, jsonResponse => {

        const distance = jsonResponse.routes[0].distance*0.001; // convert to km
        const duration = jsonResponse.routes[0].duration/60; // convert to minutes

        // add results to info box
        $('#distance').text('Distance: ' + (distance*0.62137).toFixed(2) + 'miles'); // display miles
        $('#hiddenInfo').data('distance', (distance*0.62137).toFixed(2));
        $('#duration').text('Duration: ' + parseInt(duration) + ' minutes');
        $('.info-box').show();
        const coords = jsonResponse.routes[0].geometry;

        // add the route to the map
        addRoute(coords);

        // add turn-by-turn instruction
        const all_steps = jsonResponse.routes[0].legs[0].steps;
        for (let i = 0; i < all_steps.length; i++) {
            let instr = all_steps[i].maneuver.instruction;
            $('.navigation').append('<p>' + instr + '</p>');
        }
        $('.navigation').show();

        const routeLineString = jsonResponse.routes[0].geometry.coordinates;

        // highlight crimes along route
        getBufferArea(routeLineString);
    })
}

function getBufferArea(linestring) {
    let new_arr = [];
    for (let coord of linestring) {
        new_arr.push(coord.join(' '));
    }
    const route = new_arr.join(','); 
    
    map.setLayoutProperty('crimes-heat', 'visibility', 'none');

    // remove any previously loaded buffer area 
    if (map.getSource('buffer')){
        map.removeLayer('crimes-buffer');
        map.removeSource('buffer');
    }

    $.getJSON('/api/bufferarea/' + route, response => { 
            map.addSource('buffer', {
            type: 'geojson',
            data: response,
            });
            map.addLayer({
                id: 'crimes-buffer',
                type: 'heatmap',
                source: 'buffer',
                maxzoom: 16,
                paint: {
                    // increase weight as incident code increases
                    "heatmap-weight": [
                        "interpolate",
                        ["linear"],
                        ["get", "incident_code"],
                        0, 0,
                        5, 1
                    ],
                    // increase intensity as zoom level increases
                    'heatmap-intensity': {
                        stops: [
                            [20, 1],
                            [25, 3]
                        ]
                    },
                    // assign color values be applied to points depending on their density
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, "rgba(33,102,172,0)",
                        0.2, "rgb(103,169,207)",
                        0.4, "rgb(209,229,240)",
                        0.6, "rgb(253,219,199)",
                        0.8, "rgb(239,138,98)",
                        1, "rgb(178,24,43)"
                    ],
                    // increase radius as zoom increases
                    'heatmap-radius': {
                        stops: [
                            [20, 15],
                            [25, 20]
                        ]
                    },
                    // decrease opacity to transition into the circle layer
                    'heatmap-opacity': {
                        default: 1,
                        stops: [
                            [16, 1],
                            [25, 0.8]
                        ]
                    },
                }
            }, 'waterway-label');
    
            const distance = parseFloat($('#hiddenInfo').data('distance'));
            const vcPerMi = response['violent_crime_count'] / distance;            
            if (vcPerMi >= 10) {
                showCrimeScore(response['violent_crime_count']);
            }
    })
}

// display crime scores if more than 10 violent crimes per mile
function showCrimeScore(crimeScore) {
    // display crime score and get alt button
    
    $('#violent-crime-count').html(crimeScore + ' violent crime reports');
    $('#violent-crime-count').show();
    $('#get-alt').show();
}

//get alternative route
$('#get-alt').on('click', () => {
    const start = $('#hiddenInfo').data('start');
    const start_line = start.split(',').join(' ');
    const end = $('#hiddenInfo').data('destination');
    const end_line = end.split(',').join(' ');
    const linestring = [start_line, end_line].join(',');
    $.getJSON('/api/alternatives/' + linestring, data => {
        let urlArr = [];
        for (let point of data) {
            point = point.join(',');
            const arr = [start, point, end].join(';');
            urlArr.push(arr);
        }
        const currentScore = parseInt($('#violent-crime-count').html());
        getSaferRoute(urlArr, currentScore);
    })
})

function getSaferRoute(arr, score) {    
    $.getJSON('/api/safest/' + score + '/' + arr[0] + '/' + arr[1] + '/' + arr[2] + '/' + arr[3], response => {
        if (response === 'None Found') {
            alert('Sorry, no safer route found.')
        } else {
            // remove current route    
            map.removeLayer('route');
            map.removeSource('route');
            // remove current navigation instruction
            $('.navigation').text('');
            getMatch(response[0]);
            $('#violent-crime-count').html(response[1] + ' violent crime reports');
        }    
    })
}

// adds the route as a layer on the map
function addRoute (coords) {
// check if the route is already loaded
    if (map.getSource('route')) {
        map.removeLayer('route')
        map.removeSource('route')
    }
    map.setZoom(13);
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
    let new_arr = [];
    for (let coord of coords.coordinates) {
        new_arr.push(coord.join(' '));
    }
    const route = new_arr.join(',');
    $('#hiddenInfo').attr('data-route', route);
}


map.on('click', 'route', () => {
    $('#routeModal').modal('show');
})

$('#saveroute').on('click', () => {
    const route = $('#hiddenInfo').data('route');
    $.post('/saveroute/' + route)
        .done(
            () => {
                $('#routeModal').modal('hide');
            })
        .fail(function(jqxhr, settings, ex) {
            alert('Error:', ex);
        })
})


// remove the layer if it exists
function removeRoute () {
    if (map.getSource('route')) {
        map.setLayoutProperty('crimes-heat', 'visibility', 'visible');
        end.clear();
        marker.remove();
        map.removeLayer('route');
        map.removeSource('route');
        map.removeLayer('crimes-buffer');
        map.removeSource('buffer');
        $('#clear-route').hide();
        $('.info-box').hide();
        $('.navigation').hide();
        $('#violent-crime-count').hide();
        $('#get-alt').hide();
        $('#hiddenInfo').removeAttr('data-start');
        $('#hiddenInfo').removeData('start')
        $('#hiddenInfo').removeAttr('data-destination');
        $('#hiddenInfo').removeData('destination');
        map.removeControl(start);
    } else  {
        return;
    }
}

// add create, update, or delete actions
map.on('draw.create', updateRoute);
map.on('draw.update', updateRoute);
map.on('draw.delete', removeRoute);

// form validation for register
// $('#needs-validation').on('submit', () => {
//     if ($('#needs-validation').checkValidity() === false) {
//         event.preventDefault();
//         event.stopPropagation();
//     }
//     $('#needs-validation').classList.add('was-validated');
// })

window.addEventListener('load', function() {
    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    var forms = document.getElementsByClassName('needs-validation');
    // Loop over them and prevent submission
    var validation = Array.prototype.filter.call(forms, function(form) {
        form.addEventListener('submit', function(event) {
            if (form.checkValidity() === false) {
                event.preventDefault();
                event.stopPropagation();
            }
        form.classList.add('was-validated');
        }, false);
    });
}, false);