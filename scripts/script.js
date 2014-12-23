"use strict";

$(document).ready(function() {
  smokeMap.apply(this);
});

function smokeMap() {
  /* Variables */
  var COUNTY_DATA, STATE_DATA, po, map, stateLayer, countyLayer,
  KEYS = { // All data keys
    future: {
      length: "Future_length",
      intensity: "Future_intensity",
      seasonLength: "Future_seasonlength",
      sw6: "Future_SWnum6y",
      sw1: "Future_SWnum1y",
      swDay: "Future_SWdaynum",
      index: "Future_index2"
    },
    present: {
      length: "PD_length",
      intensity: "PD_intensity",
      seasonLength: "PD_seasonlength",
      sw6: "PD_SWnum6y",
      sw1: "PD_SWnum1y",
      swDay: "PD_SWdaynum",
      index: "PD_index2"
    }
  },
  KEY_TO_NAME = { // Key name to pretty, canonical name
    length: "Length",
    intensity: "Intensity",
    seasonLength: "Season Length",
    sw6: "Smoke Wave 6",
    sw1: "Smoke Wave 1",
    swDay: "Smoke Wave Num Days",
    index: "FSRI index"
  },
  // Classes for different colors
  CLASSES = ["color-0", "color-1", "color-2", "color-3", "color-4", "color-5",
    "color-6", "color-7", "color-8"],
  VIEW = { // Variables to control whats shown in the data container.
    time: "present",
    show: "county",
    dataType: "length",
    sortBy: "diff",
    currentName: undefined,
    currentFips: undefined
  },
  DATA_CONTAINER_ID = "#smoke-map-data";

  /* Start code */
  po = org.polymaps; // Load map
  map = po.map()
    .container(document.getElementById("smoke-map").appendChild(po.svg("svg")))
    .zoom(4.9)
    .center({lat: 39.2, lon: -120});

  stateLayer = po.geoJson()                   // Load state shapes
    .url("./data/states.json")
    .id("states")
    .on("load", function(e) {
      $.each(e.features, function(i, f) {     // Attach name and fips code to
        var p = f.data.properties;            // to each state <path> element
        $(f.element).attr("name", p["NAME"]);
        $(f.element).attr("fips", p["STATE"]);
        $(f.element).attr("abbr", p["ABBR"]);
      });
      attachPathClickHandlers("#states");     // Attach click handlers
      makeStateLabels();
    });
    
  countyLayer = po.geoJson()                  // Load county shapes
    .url("./data/counties.json")
    .id("counties")
    .on("load", function(e) {
      preparePaths(e); // On load, prepare paths
    });
  adjustView(); // Add layers to map so data loads
  attachInputChangeHandlers(); 

  $.getJSON("./data/all_sw.json", function(data) { // Get geoJSON data
    COUNTY_DATA = data;
    STATE_DATA = {};
    $.each(data, function(i, d) { // Build state map from county data
      var stateFips = d["STATE_FIPS"];
      STATE_DATA[stateFips] = STATE_DATA[stateFips] || [];
      STATE_DATA[stateFips].push(d);
      // Convert each key to a number if it can be.
      $.each(d, function(key, value) {
        if (!isNaN(parseFloat(value))) {
          d[key] = parseFloat(value);
        }
      })
    });
  });

  var arePathsPrepared = false,
      requestCount = 0;
  function preparePaths(e) {
    if (arePathsPrepared) { // Don't run if already run
      return;
    }
    // Only go if GeoJSON is loaded
    if (COUNTY_DATA === undefined) {
      if (requestCount < 10) {
        requestCount++;
        console.log("JSON not ready, trying again: try #"+ requestCount);
        setTimeout(function() {
          preparePaths(e);
        }, 200);
      } else {
        alert("The data failed to load—please check your connection and " +
          "refresh the page.")
      }
      return;
    }
    arePathsPrepared = true;
    $.each(e.features, function(i, f) {      // Attach data to each <path>
      var p = f.data.properties;
      var fips = p["STATE"] + p["COUNTY"];   // Get fips code
      if (COUNTY_DATA[fips] === undefined) {
        // If no data, disable. This should, in theory, never happen because
        // all counties with no data were removed from the counties.json file.
        addClass(f.element, "disabled");
      } else {
        // Store fips and name on each <path> element.
        $(f.element).attr("fips", fips);     // Add fips code as "fips" attr
        $(f.element).attr("name", p["NAME"]);// Add county name as "name" attr
        colorCounty(f.element);              // Color the county accordingly
      }
    });
    attachPathClickHandlers("#counties");
  }

  /*
   * Attaches click handlers on <path> elements so sidebar
   * shows data when clicked. Used for both state and county paths.
   * Pass in '#states' (or whatever was used for the state layer id) to attach
   * to state <path>s, or '#counties' for the county <path>s.
   */
  function attachPathClickHandlers(parentId) {
    // Attach event handlers to available paths
    $(parentId + " path:not(.disabled)").click(function(e) {
      var elem = $(e.currentTarget);
      var fips = elem.attr("fips");
      // If the FIPS code is 5 long, show county data. Otherwise show state data.
      fips.length === 5 ? showCountyData(fips, elem.attr("name")) :
        showStateData(fips, elem.attr("name"));
      removeClass($("path.selected"), "selected"); // Remove previous highlight
      addClass(elem, "selected");                  // Highlight clicked county 
    });
  }
  /*
   * Attaches change handlers to inputs to update the view when options are 
   * changed.
   */
  function attachInputChangeHandlers() {
    // Attach event handlers to checkboxes
    $("input[name='smoke-map-time']").change(function(e) {
      VIEW.time = $(e.currentTarget).data("time");
      // Recolor map
      $.each($("#counties path"), function(i, p) {
        colorCounty(p);
      });
    });
    // Attach event handlers to checkboxes
    $("input[name='smoke-map-show']").change(function(e) {
      VIEW.show = $(e.currentTarget).data("show");
      map.remove(countyLayer).remove(stateLayer)
      adjustView();
    });
    // Attach select event handlers
    $("select[name='smoke-map-data-type']").change(function(e) {
      VIEW.dataType = $(this).val();
      showStateData();
    });
    $("select[name='smoke-map-data-sort']").change(function(e) {
      VIEW.sortBy = $(this).val();
      showStateData();
    });
  }
  /* 
   * Given a county feature, assigns correct class depending on 
   * given mode. The element must have a 'fips' attribute.
   */
  function colorCounty(element) {
    var fips = $(element).attr("fips");
    var key = KEYS[VIEW.time].index;
    // Get the corresponding color class from the 'classes' array.
    var c = CLASSES[COUNTY_DATA[fips][key]];
    $.each(CLASSES, function(i, c) {
      removeClass(element, c); // Remove any previous classes
    });
    addClass(element, c);      // Add correct class
  }

  function showStateData(fips, name) {
    VIEW.currentFips = fips || VIEW.currentFips; // Store values in case we need to update view
    VIEW.currentName = name || VIEW.currentName;
    var data = STATE_DATA[VIEW.currentFips];
    if (!data) {
      return;
    }
    var counties = [], presentData = [], futureData = [], diffData = [];
    var sortedData = _.sortBy(data, function(d) {
      var pd = d[KEYS.present[VIEW.dataType]],
          ft = d[KEYS.future[VIEW.dataType]],
          fips = d["FIPS"],
          toReturn;
      switch(VIEW.sortBy) {  // Sort by correct value
        case "present":
          toReturn = pd;
          break;
        case "future":
          toReturn = ft;
          break;
        case "diff":
          toReturn = ft-pd;
          break;
        default:
          toReturn = fips;
      }
      return toReturn;
    });
    $.each(sortedData, function(i, d) {
      // Remove 'County' from county name and add (fips code).
      counties.push(d["COUNTY"].replace(" County", "") + " (" + d["FIPS"] + ")");
      var pd = d[KEYS.present[VIEW.dataType]],
          ft = d[KEYS.future[VIEW.dataType]],
          diff = Math.round((ft-pd)*100) / 100, // Round to two decimal places
          fips = d["FIPS"];
      presentData.push({y: pd, fips: fips});
      futureData.push({y: ft, fips: fips});
      diffData.push({y: diff, fips: fips});
    });
    $("#smoke-map-data-container").addClass("active");
    $(DATA_CONTAINER_ID).highcharts({
      chart: { type: 'bar' },
      title: {
        align: "left",
        text: VIEW.currentName + " · " + KEY_TO_NAME[VIEW.dataType]
      },
      xAxis: {
        categories: counties,
        labels: {
          style: {"fontSize": "60%"}
        }
      },
      series: [
        { name: "Present", data: presentData },
        { name: "Future", data: futureData },
        { name: "Difference", data: diffData },
      ],
      plotOptions: {
        bar: {
          point: {
            events: {
              mouseOver: function() {
                addClass($("path[fips='" + this.fips + "']"), "accent");
              },
              mouseOut: function() {
                removeClass($("path[fips='" + this.fips + "']"), "accent");
              }
            }
          }
        }
      }
    });
    var chart = $(DATA_CONTAINER_ID).highcharts();
    if (VIEW.sortBy !== "present" && VIEW.sortBy !== "fips") {
      chart.series[0].hide();
    }
    if (VIEW.sortBy !== "future") {
      chart.series[1].hide();
    }
    if (VIEW.sortBy !== "diff") {
      chart.series[2].hide();
    }
    $("#smoke-map-sort-by").removeClass("hidden");
  }
  /*
   * Given a fips code, populates the data-container div with the proper chart.
   */
  function showCountyData(fips) {
    var data = COUNTY_DATA[fips];
    if (!data) {
      return;
    }
    var countyKeys = ["seasonLength", "intensity", "length", "sw1", "sw6", "swDay"];
    var presentData = [];
    var futureData = [];
    $.each(countyKeys, function(i, key) {
      presentData.push(data[KEYS.present[key]]);
      futureData.push(data[KEYS.future[key]]);
    });
    $(DATA_CONTAINER_ID).highcharts({
      chart: { type: 'bar' },
      title: {
        align: "left",
        text: data["COUNTY"] + " (" + data["STATE"] + ")"
      },
      xAxis: {
        categories: _.map(countyKeys, function(key) {
          return KEY_TO_NAME[key];
        })
      },
      series: [
        { name: "Present", data: presentData },
        { name: "Future", data: futureData }
      ]
    });
  }

  function adjustView() {
    removeClass($("path.selected"), "selected");
    $("#smoke-map-data-sort").addClass("hidden");
    if (VIEW.show === "county") {
      $(DATA_CONTAINER_ID).html("<em>Choose a county to view its data</em>");
      map.add(stateLayer).add(countyLayer); // County layer on top
      removeClass($("#states"), "active");
      addClass($("#counties"), "active");
    } else {
      $(DATA_CONTAINER_ID).html("<em>Choose a state to view its data</em>");
      map.add(countyLayer).add(stateLayer); // State layer on top
      removeClass($("#counties"), "active");
      addClass($("#states"), "active");
    }
  }

  function makeStateLabels() {
    $("#states path").each(function(i, p) {
      var abbr = $(p).attr("abbr");
      var center = findPathCenter(p);
      var label = document.createElementNS("http://www.w3.org/2000/svg", 'text');
      switch (abbr) { // Special case labels
        case "ID":
          center.y += 50;
          center.x -= 10;
          break;
        case "CA":
          center.x -= 20;
          break;
        case "NV":
          center.y -= 20;
          center.x += 10;
          break;
      }
      $(label)
        .attr({
          x: center.x - 15,
          y: center.y + 6,
          class: "state-label"
        })
        .text(abbr);
      $(p).before(label);
    });
  }

  /* SVG utility functions */
  function findPathCenter(pathElem) {
    var bbox = pathElem.getBBox(),
        x = Math.floor(bbox.x + bbox.width/2.0),
        y = Math.floor(bbox.y + bbox.height/2.0);
    return {x: x, y: y};
  }
  /* jQuery add/removeClass doesn't work on SVG, so writing my own... */
  function addClass(elem, newClass) {
    if (!newClass) {
      return;
    }
    if (elem.length !== undefined) { // is an array
      $.each(elem, function(i, e) {
        addClass_(e, newClass);
      });
    } else {
      addClass_(elem, newClass);
    }
  }
  function addClass_(elem, newClass) {
    var c = $(elem).attr("class");
    if (!c || c.indexOf(newClass) === -1) { // Not already added
      $(elem).attr("class", c + " " + newClass);
    }
  }
  function removeClass(elem, rmClass) {
    if (elem.length !== undefined) { // is an array
      $.each(elem, function(i, e) {
        removeClass_(e, rmClass);
      });
    } else {
      removeClass_(elem, rmClass);
    }
  }
  function removeClass_(elem, rmClass) {
    var cs = $(elem).attr("class");
    if (!cs) {
      return;
    }
    cs = cs.split(" ");
    var i = cs.indexOf(rmClass);
    if (i !== -1) {
      cs.splice(i, 1);
    }
    $(elem).attr("class", cs.join(" "));
  }
}