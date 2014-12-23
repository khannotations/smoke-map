"use strict";

$(document).ready(function() {
  var COUNTY_DATA, STATE_DATA, po, map, stateLayer, countyLayer,
  KEYS = {
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
  CODE_TO_NAME = {
    length: "Length",
    intensity: "Intensity",
    seasonLength: "Season Length",
    sw6: "Smoke Wave 6",
    sw1: "Smoke Wave 1",
    swDay: "Smoke Wave Num Days",
    index: "FSRI index"
  },
  CLASSES = ["index-0", "index-1", "index-2", "index-3", "index-4", "index-5"],
  MODE = "present", VIEW = "state", DATA_TYPE = "length", SORTBY = "diff",
  CURR_NAME, CURR_FIPS,
  DATA_CONTAINER_ID = "#smoke-map-data";
  // Load map
  po = org.polymaps;
  map = po.map()
    .container(document.getElementById("smoke-map").appendChild(po.svg("svg")))
    // .add(po.interact())
    .zoom(4.9)
    .center({lat: 41, lon: -120});
  // Load state shapes
  stateLayer = po.geoJson()
    .url("./data/states.json")
    .id("states")
    .on("load", function(e) {
      $.each(e.features, function(i, f) {
        var p = f.data.properties;
        $(f.element).attr("name", p["NAME"]);
        $(f.element).attr("fips", p["STATE"]);
      });
      attachPathClickHandler("#states");
    });
  map.add(stateLayer);
    
  // Load county shapes
  countyLayer = po.geoJson()
    .url("./data/counties.json")
    .id("counties")
    .on("load", function(e) {
      preparePaths(e); // Onload, prepare paths
    });
  map.add(countyLayer);

  // While map loads, get geoJSON data
  $.getJSON("./data/all_sw.json", function(data) {
    COUNTY_DATA = data;
    STATE_DATA = {};
    // Build state map
    $.each(data, function(i, d) {
      var stateFips = d["STATE_FIPS"];
      STATE_DATA[stateFips] = STATE_DATA[stateFips] || [];
      STATE_DATA[stateFips].push(d);
    });
  });

  var arePathsPrepared = false;
  var count = 0;
  function preparePaths(e) {
    var features = e.features;
    if (arePathsPrepared) { // Don't run if already run
      return;
    }
    // Only go if GeoJSON and map is loaded
    if (COUNTY_DATA === undefined) {
      if (count < 10) {
        count++;
        console.log("JSON not ready, trying again: try #"+ count);
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
    // Attach data to each path
    $.each(features, function(i, f) {
      var p = f.data.properties;
      var fips = p["STATE"] + p["COUNTY"];   // Get fips code
      if (COUNTY_DATA[fips] === undefined) {
        // If no data, disable. This should, in theory, never happen because
        // all counties with no data were removed from the counties.json file.
        addClass(f.element, "disabled");
      } else {
        // Store data on each <path> element.
        $(f.element).attr("fips", fips);     // Add fips code as "fips" attr
        $(f.element).attr("name", p["NAME"]);// Add county name as "name" attr
        colorCounty(f.element);                // Color the county accordingly
      }
    });
    attachPathClickHandler("#counties");
    adjustView();
    // Attach event handlers to checkboxes
    $("input[name='smoke-map-time']").change(function(e) {
      MODE = $(e.currentTarget).data("time");
      // Recolor map
      $.each($("#counties path"), function(i, p) {
        colorCounty(p);
      });
    });
    // Attach event handlers to checkboxes
    $("input[name='smoke-map-view']").change(function(e) {
      VIEW = $(e.currentTarget).data("view");
      map.remove(countyLayer).remove(stateLayer)
      adjustView();
    });
    // Attach select event handlers
    $("select[name='smoke-map-data-type']").change(function(e) {
      DATA_TYPE = $(this).val();
      showStateData();
    });
    $("select[name='smoke-map-data-sort']").change(function(e) {
      SORTBY = $(this).val();
      showStateData();
    });
  }

  /* Used for both state and county paths */
  function attachPathClickHandler(parentId) {
    // Attach event handlers to available paths
    $(parentId + " path:not(.disabled)").click(function(e) {
      var elem = $(e.currentTarget);
      var fips = elem.attr("fips");
      fips.length === 5 ? showCountyData(fips, elem.attr("name")) :
        showStateData(fips, elem.attr("name"));
      removeClass($("path.selected"), "selected"); // Remove previous highlight
      addClass(elem, "selected");                  // Highlight clicked county 
    });
  }
  /* 
   * Given a county feature, assigns correct class depending on 
   * given mode. The element should have a 'fips' attribute with its code.
   */
  function colorCounty(element) {
    var fips = $(element).attr("fips");
    var key = MODE === "future" ? KEYS.future.index : KEYS.present.index;
    // Get the corresponding class from the 'classes' array.
    var c = CLASSES[COUNTY_DATA[fips][key]];
    $.each(CLASSES, function(i, c) {
      // Remove any previous classes
      removeClass(element, c);
    });
    // Add correct class
    addClass(element, c);
  }

  function showStateData(fips, name) {
    CURR_FIPS = fips || CURR_FIPS;
    CURR_NAME = name || CURR_NAME;
    var data = STATE_DATA[CURR_FIPS];
    if (!data) {
      return;
    }
    var counties = [], presentData = [], futureData = [], diffData = [];
    var sortedData = _.sortBy(data, function(d) {
      var pd = parseFloat(d[KEYS.present[DATA_TYPE]]);
      var ft = parseFloat(d[KEYS.future[DATA_TYPE]]);
      var fips = parseInt(d["FIPS"]);
      console.log(fips);
      var toReturn;
      switch(SORTBY) {
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
      counties.push(d["COUNTY"].replace(" County", "") + " (" + d["FIPS"] + ")");
      var pd = parseFloat(d[KEYS.present[DATA_TYPE]]);
      var ft = parseFloat(d[KEYS.future[DATA_TYPE]]);
      var diff = Math.round((ft-pd)*100) / 100;
      var fips = parseInt(d["FIPS"]);
      presentData.push({y: pd, fips: fips});
      futureData.push({y: ft, fips: fips});
      diffData.push({y: diff, fips: fips});
    });
    $("#smoke-map-data-container").addClass("active");
    $(DATA_CONTAINER_ID).highcharts({
      chart: { type: 'bar' },
      title: {
        align: "left",
        text: CURR_NAME + " · " + CODE_TO_NAME[DATA_TYPE]
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
              mouseOut: function() {
                removeClass($("path[fips='" + this.fips + "']"), "accent");
              },
              mouseOver: function() {
                addClass($("path[fips='" + this.fips + "']"), "accent");
              }
            }
          }
        }
      }
    });
    var chart = $(DATA_CONTAINER_ID).highcharts();
    if (SORTBY !== "present" && SORTBY !== "fips") {
      chart.series[0].hide();
    }
    if (SORTBY !== "future") {
      chart.series[1].hide();
    }
    if (SORTBY !== "diff") {
      chart.series[2].hide();
    }
  }
  /*
   * Given a fips code, populates the data-container div with the corresponding
   * HTML
   */
  function showCountyData(fips) {
    var data = COUNTY_DATA[fips];
    if (!data) {
      return;
    }
    var presentData = [
      parseFloat(data[KEYS.present.seasonLength]),
      parseFloat(data[KEYS.present.intensity]),
      parseFloat(data[KEYS.present.length]),
      parseFloat(data[KEYS.present.sw1]),
      parseFloat(data[KEYS.present.sw6]),
      parseFloat(data[KEYS.present.swDay]),
    ];
    var futureData = [
      parseFloat(data[KEYS.future.seasonLength]),
      parseFloat(data[KEYS.future.intensity]),
      parseFloat(data[KEYS.future.length]),
      parseFloat(data[KEYS.future.sw1]),
      parseFloat(data[KEYS.future.sw6]),
      parseFloat(data[KEYS.future.swDay]),
    ];
    $(DATA_CONTAINER_ID).highcharts({
      chart: { type: 'bar' },
      title: {
        align: "left",
        text: data["COUNTY"] + " (" + data["STATE"] + ")"
      },
      xAxis: {
        categories: _.map(_.keys(KEYS.future), function(code) {
          console.log(code);
          return CODE_TO_NAME[code];
        })
      },
      series: [
        { name: "Present", data: presentData },
        { name: "Future", data: futureData }
      ]
    });
  }

  function adjustView() {
    removeClass($(".selected"), "selected");
    $("#smoke-map-data-container").removeClass("active");
    if (VIEW === "county") {
      $(DATA_CONTAINER_ID).html("<em>Choose a county to view its data</em>");
      map.add(stateLayer).add(countyLayer);
      removeClass($("#states"), "active");
      addClass($("#counties"), "active");
      $("#smoke-map-data-options").addClass("hidden");
    } else {
      $(DATA_CONTAINER_ID).html("<em>Choose a state to view its data</em>");
      map.add(countyLayer).add(stateLayer);
      removeClass($("#counties"), "active");
      addClass($("#states"), "active");
      $("#smoke-map-data-options").removeClass("hidden");
    }
  }

  /* jQuery add/removeClass doesn't work on SVG, so writing my own... */
  function addClass(elem, newClass) {
    if (elem.length !== undefined) { // is an array
      $.each(elem, function(i, e) {
        addClass_(e, newClass);
      });
    } else {
      addClass_(elem, newClass);
    }
  }
  function addClass_(elem, newClass) {
    $(elem).attr("class", $(elem).attr("class") + " " + newClass);
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
});


  // function roundValues(fips) {
  //   var a = COUNTY_DATA[fips];
  //   $.each(a, function(key, value) {
  //     if (!isNaN(parseInt(value))) {
  //       a[key] = Math.round(a[key] * 100) / 100;
  //     }
  //   });
  // }