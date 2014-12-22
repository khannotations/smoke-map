"use strict";

$(document).ready(function() {
  var FUTURE_SW, PRESENT_SW, po, map;

  // Load map
  po = org.polymaps;
  map = po.map()
    .container(document.getElementById("map").appendChild(po.svg("svg")))
    // .add(po.interact())
    .zoom(5.1)
    .center({lat: 41, lon: -105});

  map.add(po.geoJson()
    .url("./data/counties-sm.json")
    // .features()
    .id("counties")
    .on("load", mapReady));

  // While map loads, get JSON
  // Get JSON
  $.getJSON("./data/future_sw.json", function(data) {
    FUTURE_SW = data;
    console.log(data);
  });
  $.getJSON("./data/present_sw.json", function(data) {
    PRESENT_SW = data;
  });

  function mapReady(e) {
    preparePaths(e.features);
  }

  var arePathsPrepared = false;
  var count = 0;
  function preparePaths(features) {
    if (arePathsPrepared) { // Don't run if already run
      return;
    }
    // Only go if GeoJSON and map is loaded
    if (FUTURE_SW === undefined || PRESENT_SW === undefined) {
      if (count < 10) {
        count++;
        console.log("JSON not ready, trying again: try #"+ count);
        setTimeout(function() {
          preparePaths(features);
        }, 200);
      } else {
        console.log("JSON not ready, tried 10 times. Stopping.");
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
      if (PRESENT_SW[fips] === undefined || FUTURE_SW[fips] === undefined) {
        $(f.element).attr("class", "disabled"); // If no data, disable
      } else {
        roundValues(fips);
        $(f.element).attr("fips", fips);     // Add fips code as "fips" attr
        $(f.element).attr("name", p["NAME"]);// Add county name as "name" attr
      }
    });
    // Attach event handlers to available paths
    $("path:not(.disabled)").click(function(e) {
      var elem = $(e.currentTarget);
      populateData(elem.attr("fips"), elem.attr("name"));
      $("path.selected").attr("class", "");   // Turn coloring off
      elem.attr("class", "selected");         // Highlight clicked county
    });
  }

  /*
   * Given a fips code, populates the data-container div with the corresponding
   * HTML
   */
  function populateData(fips, name) {
    var data = {}
    data.name = name;
    data.present = PRESENT_SW[fips];
    data.future = FUTURE_SW[fips];
    if (!data.present || !data.future) {
      return;
    }
    var html = $.templates("#dataContainerTmpl").render(data);
    $("#data-container").html(html);
    $("#data-container").addClass("shown"); // Show data container
  }

  function roundValues(fips) {
    var p = PRESENT_SW[fips];
    $.each(p, function(key, value) {
      if (!isNaN(parseInt(value))) {
        p[key] = Math.round(p[key] * 100) / 100;
      }
    });
    var f = FUTURE_SW[fips];
    $.each(f, function(key, value) {
      if (!isNaN(parseInt(value))) {
        f[key] = Math.round(f[key] * 100) / 100;
      }
    });
  }
});