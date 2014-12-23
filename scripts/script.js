"use strict";

$(document).ready(function() {
  var ALL_SW, po, map;
  var KEYS = {
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
  };
  var MODE = "present"; 
  var DATA_CONTAINER_ID = "#smoke-map-data-container";
  // Load map
  po = org.polymaps;
  map = po.map()
    .container(document.getElementById("smoke-map-map").appendChild(po.svg("svg")))
    // .add(po.interact())
    .zoom(4.9)
    .center({lat: 41, lon: -120});
  // Load state shapes
  map.add(po.geoJson()
    .url("./data/states.json")
    .id("states"));
  // Load county shapes
  map.add(po.geoJson()
    .url("./data/counties.json")
    .id("counties")
    .on("load", function(e) {
      preparePaths(e); // Onload, prepare paths
    }));
  // While map loads, get geoJSON data
  $.getJSON("./data/all_sw.json", function(data) {
    ALL_SW = data;
  });

  var arePathsPrepared = false;
  var count = 0;
  function preparePaths(e) {
    var features = e.features;
    if (arePathsPrepared) { // Don't run if already run
      return;
    }
    // Only go if GeoJSON and map is loaded
    if (ALL_SW === undefined) {
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
    console.log(ALL_SW);
    arePathsPrepared = true;
    // Attach data to each path
    $.each(features, function(i, f) {
      var p = f.data.properties;
      var fips = p["STATE"] + p["COUNTY"];   // Get fips code
      if (ALL_SW[fips] === undefined) {
        // If no data, disable. This should, in theory, never happen because
        // all counties with no data were removed from the counties.json file.
        $(f.element).attr("class", "disabled");
      } else {
        // Store data on each <path> element.
        $(f.element).attr("fips", fips);     // Add fips code as "fips" attr
        $(f.element).attr("name", p["NAME"]);// Add county name as "name" attr
        colorCounty(f.element);                // Color the county accordingly
      }
    });
    // Attach event handlers to available paths
    $("path:not(.disabled)").click(function(e) {
      var elem = $(e.currentTarget);
      populateData(elem.attr("fips"), elem.attr("name"));
      removeClass($("path.selected"), "selected"); // Remove previous highlight
      addClass(elem, "selected");                  // Highlight clicked county 
    });
    // Attach event handlers to checkboxes
    $("input[name='smoke-map-time']").click(function(e) {
      MODE = $(e.currentTarget).data("time");
      // Recolor map
      console.log(MODE);
      $.each($("#counties path"), function(i, p) {
        colorCounty(p);
      });
    });
  }

  /* 
   * Given a county feature, assigns correct class depending on 
   * given mode. The element should have a 'fips' attribute with its code.
   */
  function colorCounty(element) {
    var fips = $(element).attr("fips");
    var classes = ["index-0", "index-1", "index-2", "index-3", "index-4",
      "index-5"];
    var key = MODE === "future" ? KEYS.future.index : KEYS.present.index;
    console.log(key);
    // Get the corresponding class from the 'classes' array.
    var c = classes[ALL_SW[fips][key]];
    $.each(classes, function(i, c) {
      // Remove any previous classes
      removeClass(element, c);
    });
    // Add correct class
    addClass(element, c);
  }

  /*
   * Given a fips code, populates the data-container div with the corresponding
   * HTML
   */
  function populateData(fips) {
    var data = ALL_SW[fips];
    if (!data) {
      return;
    }
    console.log(data);
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
    console.log(presentData, futureData);
    $(DATA_CONTAINER_ID).highcharts({
      chart: {
        type: 'bar'
      },
      title: {
        align: "left",
        text: data["COUNTY"] + " (" + data["STATE"] + ")"
      },
      xAxis: {
        categories: ["Season length", "Intensity", "Length", "Smoke Wave (1yr)",
        "Smoke Wave (6yr)", "Smoke Wave (day #)"]
      },
      series: [
        {
          name: "Present",
          data: presentData
        },
        {
          name: "Future",
          data: futureData
        }
      ]
    });
    // var html = $.templates("#dataContainerTmpl").render(data);
    // $(DATA_CONTAINER_ID).html(html).addClass("shown");
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
    var i;
    while (i = cs.indexOf(rmClass) !== -1) {
      cs.splice(i, 1);
    }
    $(elem).attr("class", cs.join(" "));
  }
});


  // function roundValues(fips) {
  //   var a = ALL_SW[fips];
  //   $.each(a, function(key, value) {
  //     if (!isNaN(parseInt(value))) {
  //       a[key] = Math.round(a[key] * 100) / 100;
  //     }
  //   });
  // }