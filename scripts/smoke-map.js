"use strict";

$(document).ready(function() {
  smokeMap.apply(this);
});

function smokeMap() {
  /* Variables */
  var COUNTY_DATA, STATE_DATA, po, map, stateLayer, countyLayer,
  KEYS = { // All data keys
    future: {
      index: "Future_index2",
      sw1: "Future_SWnum1y",
      sw6: "Future_SWnum6y",
      swDay: "Future_SWdaynum",
      length: "Future_length",
      intensity: "Future_intensity",
      seasonLength: "Future_seasonlength",
    },
    present: {
      length: "PD_length",
      intensity: "PD_intensity",
      seasonLength: "PD_seasonlength",
      sw6: "PD_SWnum6y",
      sw1: "PD_SWnum1y",
      swDay: "PD_SWdaynum",
      index: "PD_index2"
    },
    population: {
      a1_2050: "Y2050A1",
      a2_2050: "Y2050A2",
      b1_2050: "Y2050B1",
      b2_2050: "Y2050B2",
      bc_2050: "Y2050BC",
      y_2005: "Y2005"
    }
  },
  KEY_TO_NAME = { // Key name to pretty, canonical name
    length: "Length",
    intensity: "Intensity",
    seasonLength: "Season Length",
    sw6: "Smoke Wave 6",
    sw1: "Smoke Wave 1",
    swDay: "Smoke Wave Num Days",
    index: "FSRI index",
    a1_2050: "2050 Pop., A1",
    a2_2050: "2050 Pop., A2",
    b1_2050: "2050 Pop., B1",
    b2_2050: "2050 Pop., B2",
    bc_2050: "2050 Pop., BC",
    y_2005: "2005 Pop.",
  },
  COLOR_STOPS = {
    length: {
      values: [0, 2, 2.5, 3, 3.5, 4, 4.5], // 7 stops
    },
    intensity: {
      values: [0, 10, 15, 20, 25, 30, 50], // 8 stops
    },
    sw1: {
      values: [0, 0.7, 1.3, 2, 2.7, 3.3, 4], // 8 stops
    },
    sw6: {
      values: [0, 4, 8, 12, 16, 20, 24], // 8 stops (sw1 * 6)
    },
    index: {
      values: [0, 1, 2, 3, 4, 5] // Only 6 stops (special cased)
    },

  },
  // Classes for different colors
  CLASSES = ["color-0", "color-1", "color-2", "color-3", "color-4", "color-5",
    "color-6", "color-7", "color-8"],
  VIEW = { // Variables to control whats shown in the data container.
    time: "present",
    show: "county",
    colorBy: "index",
    dataType: "length",
    countyDataType: "smoke",
    stateSortBy: "diff",
    stateDataType: "sw1",
    currentName: undefined,
    currentFips: undefined
  },
  DATA_CONTAINER_ID = "#smoke-map-data";

  /* Start code */
  buildDom(); // Start by building all necessary elements
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
      $("#states path").click(function(e) {
        var elem = $(e.currentTarget);
        showStateData(elem.attr("abbr"), elem.attr("name"));
        removeClass($("path.selected"), "selected"); // Remove prev highlight
        addClass(elem, "selected");                  // Highlight clicked state 
      });
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
    COUNTY_DATA = {};
    STATE_DATA = {};
    $.each(data, function(i, d) { // Build state map from county data
      COUNTY_DATA[d["FIPS"]] = d;
      var stateFips = d["STATE"];
      STATE_DATA[stateFips] = STATE_DATA[stateFips] || [];
      STATE_DATA[stateFips].push(d);
      // Convert each key to a number if it can be.
      $.each(d, function(key, value) {
        if (key !== "FIPS" && !isNaN(parseFloat(value))) {
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
      }
    });
    colorMap();
    // Click handlers for county paths (shows county data in data panel)
    $("#counties path").click(function(e) {
        var elem = $(e.currentTarget);
        showCountyData(elem.attr("fips"), elem.attr("name"));
        removeClass($("path.selected"), "selected"); // Remove prev highlight
        addClass(elem, "selected");                  // Highlight clicked county 
      });
    // Hover handler (updates tooltip)
    $("#counties path:not(.disabled)").hover(function(e) {
        var elem = $(e.currentTarget)
        var fips = elem.attr("fips");
        var name = elem.attr("name");
        var html = "<b>" + name + " (" +  fips + ")</b><br>" +
          KEY_TO_NAME[VIEW.colorBy] + " (" + VIEW.time + "): " +
          COUNTY_DATA[fips][KEYS[VIEW.time][VIEW.colorBy]];
        $("#smoke-map-tooltip").html(html).show();
    }, function(e) {
      $("#smoke-map-tooltip").hide();
    });
  }

  /*
   * Attaches change handlers to update the view when options are changed.
   */
  function attachInputChangeHandlers() {
    // Attach event handlers to checkboxes
    $("input[name='smoke-map-time']").change(function(e) {
      VIEW.time = $(e.currentTarget).data("time");
      colorMap(); // Recolor map
    });
    // Attach event handlers to checkboxes
    $("input[name='smoke-map-show']").change(function(e) {
      VIEW.show = $(e.currentTarget).data("show");
      map.remove(countyLayer).remove(stateLayer)
      adjustView();
    });
    // Attach select event handlers
    $("select[name='smoke-map-color-by']").change(function(e) {
      VIEW.colorBy = $(this).val();
      showStateData();
      colorMap();
    });
    $("select[name='smoke-map-state-data-sort']").change(function(e) {
      VIEW.stateSortBy = $(this).val();
      showStateData();
    });
    $("select[name='smoke-map-state-data-type']").change(function(e) {
      VIEW.stateDataType = $(this).val();
      showStateData();
    });
    $("select[name='smoke-map-county-data-type']").change(function(e) {
      VIEW.countyDataType = $(this).val();
      showCountyData();
    });
  }

  /*
   * Colors the entire map depending on VIEW.colorBy, and adjusts the legend.
   */
  function colorMap() {
    var values = COLOR_STOPS[VIEW.colorBy].values;
    $(".color-block").hide();
    $.each(values, function(index, val) {
      var elem = $(".color-"+index);
      var text;
      if (VIEW.colorBy === "index" || index === 0) {
        text = index + "";
      } else {
        text = values[index-1] + " - " + values[index];
      }
      $(elem).find(".text").text(text);
      $(elem).show();
    });
    if (VIEW.colorBy !== "index") {
      $(".color-"+values.length).find(".text").text("> " +
        values[values.length-1]);
      $(".color-"+values.length).show();
    }
    $.each($("#counties path"), function(i, p) {
      colorCounty(p);
    });
  }
  /* 
   * Given a county element, assigns color class depending on 
   * given mode. The element must have a 'fips' attribute.
   */
  function colorCounty(element) {
    var fips = $(element).attr("fips");
    var key = KEYS[VIEW.time][VIEW.colorBy];
    var val = COUNTY_DATA[fips][key];
    var values = COLOR_STOPS[VIEW.colorBy].values;
    var index = 0;
    while(values[index] !== undefined && val > values[index]) {
      index++;
    }
    // Get the corresponding color class from the 'classes' array.
    var c = CLASSES[index];
    $.each(CLASSES, function(i, c) {
      removeClass(element, c); // Remove any previous classes
    });
    addClass(element, c);      // Add correct class
  }

  function showStateData(fips, name) {
    // Store values in case we need to update view
    VIEW.currentFips = fips || VIEW.currentFips;
    VIEW.currentName = name || VIEW.currentName;
    var data = STATE_DATA[VIEW.currentFips];
    console.log(VIEW.stateDataType, data);
    if (!data) {
      return;
    }
    var counties = [], presentData = [], futureData = [], diffData = [];
    var sortedData = _.sortBy(data, function(d) {
      var presentVal = d[KEYS.present[VIEW.stateDataType]],
          futureVal = d[KEYS.future[VIEW.stateDataType]],
          fips = d["FIPS"],
          toReturn;
      switch(VIEW.stateSortBy) {  // Sort by correct value
        case "present":
          toReturn = presentVal;
          break;
        case "future":
          toReturn = futureVal;
          break;
        case "diff":
          toReturn = futureVal-presentVal;
          break;
        default:
          toReturn = fips;
      }
      return toReturn;
    });
    $.each(sortedData, function(i, d) {
      // Remove 'County' from county name and add (fips code).
      counties.push(d["COUNTY"].replace(" County", "")+" ("+d["FIPS"]+")");
      var presentVal = d[KEYS.present[VIEW.stateDataType]] || 0,
          futureVal = d[KEYS.future[VIEW.stateDataType]] || 0,
          // Round to two decimal places
          diff = Math.round((futureVal-presentVal)*100) / 100,
          fips = d["FIPS"] || "";
      presentData.push({y: presentVal, fips: fips});
      futureData.push({y: futureVal, fips: fips});
      diffData.push({y: diff, fips: fips});
    });
    $("#smoke-map-data-container").addClass("active");
    $(DATA_CONTAINER_ID).highcharts({
      chart: { type: 'bar' },
      title: {
        align: "left",
        text: VIEW.currentName + " · " + KEY_TO_NAME[VIEW.stateDataType]
      },
      subtitle: {
        align: "left",
        text: "Data shown by county"
      },
      xAxis: {
        categories: counties,
        labels: {
          style: {"fontSize": "60%"}
        }
      },
      yAxis: {
        title: { text: null }
      },
      series: [
        { name: "Present", data: presentData },
        { name: "Future", data: futureData },
        { name: "Difference", data: diffData },
      ],
      tooltip: { enabled: false },
      // Accents counties on hover
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
    if (VIEW.stateSortBy !== "present" && VIEW.stateSortBy !== "fips") {
      chart.series[0].hide();
    }
    if (VIEW.stateSortBy !== "future") {
      chart.series[1].hide();
    }
    if (VIEW.stateSortBy !== "diff") {
      chart.series[2].hide();
    }
    $("#smoke-map-state-options").removeClass("hidden");
  }
  /*
   * Given a fips code, populates the data-container div with the proper chart
   * for the county indicated by the fips code, or the last county shown
   * if no fips code is given.
   */
  function showCountyData(fips) {
    // Store values in case we need to update view
    VIEW.currentFips = fips || VIEW.currentFips;
    VIEW.currentName = name || VIEW.currentName;
    var data = COUNTY_DATA[VIEW.currentFips];
    if (!data) {
      return;
    }
    if (VIEW.countyDataType === "smoke") {
      var countyKeys = ["sw1", "sw6", "swDay", "seasonLength", "intensity",
      "length"];
      var presentData = [];
      var futureData = [];
      $.each(countyKeys, function(i, key) {
        presentData.push(data[KEYS.present[key]] || 0);
        futureData.push(data[KEYS.future[key]] || 0);
      });
      $(DATA_CONTAINER_ID).highcharts({
        chart: { type: 'bar' },
        title: {
          align: "left",
          text: data["COUNTY"] + " (" + data["STATE"] + ")"
        },
        series: [
          { name: "Present", data: presentData },
          { name: "Future", data: futureData }
        ],
        xAxis: {
          categories: _.map(countyKeys, function(key) {
            return KEY_TO_NAME[key];
          })
        },
        yAxis: {
          title: { text: null }
        },
        tooltip: { enabled: false }
      });
    } else {
      var populationKeys = _.keys(KEYS.population);
      var populationData = [];
      $.each(populationKeys, function(i, key) {
        populationData.push(data[KEYS.population[key]]);
      });
      $(DATA_CONTAINER_ID).highcharts({
        chart: { type: 'bar' },
        title: {
          align: "left",
          text: data["COUNTY"] + " (" + data["STATE"] + ")"
        },
        series: [
          { name: "Population", data: populationData },
        ],
        xAxis: {
          categories: _.map(populationKeys, function(key) {
            return KEY_TO_NAME[key];
          })
        },
        yAxis: {
          title: { text: null }
        },
        tooltip: { enabled: false }
      });
    }
    $("#smoke-map-county-options").removeClass("hidden");
  }

  /* Create the DOM */
  function buildDom() {
    var i, newDiv = "<div></div>",
        root = $(newDiv).attr("id", "smoke-map"),
        // Top-left controls
        controlC = $(newDiv).attr("id", "smoke-map-control-container")
          .addClass("smoke-map-content-container"),
        // Bottom-left data panel
        dataC = $(newDiv).attr("id", "smoke-map-data-container")
          .addClass("smoke-map-content-container"),
        // Bottom center legend
        legendC = $(newDiv).attr("id", "smoke-map-legend-container")

    // Control container
    var colorOptions = [];
    $.each(["index", "sw1", "sw6", "length", "intensity"], function(i, key) {
      colorOptions.push(createOption(key, KEY_TO_NAME[key]));
    });
    var controlTable = $("<table></table>").append(
      $("<tr></tr>").append(
        $("<td></td>").text("Color by:"),
        $("<td></td>").attr("colspan", 2).append(
          // Color by <select> element
          $("<select></select>").attr("name", "smoke-map-color-by")
            .append(colorOptions)
        )
      ),
      $("<tr></tr>").append(
        $("<td></td>").text("Time:"),
        $("<td></td>").append(
          createRadio("time", "present", "checked"),
          document.createTextNode("Present")
        ),
        $("<td></td>").append(
          createRadio("time", "future"),
          document.createTextNode("Future")
        )
      ),
      $("<tr></tr>").append(
        $("<td></td>").text("View:"),
        $("<td></td>").append(
          createRadio("show", "county", "checked"),
          document.createTextNode("County")
        ),
        $("<td></td>").append(
          createRadio("show", "state"),
          document.createTextNode("State")
        )
      )
    );
    controlC.append($(newDiv).attr("id", "smoke-map-data-options").append(
        $("<p></p>").addClass("smoke-map-head")
          .text("Smoke Wave Map: Color Controls"),
        controlTable
      )
    );
    // Data container
    var countyOptions = $(newDiv).attr("id", "smoke-map-county-options").append(
      document.createTextNode("Data: "),
      $("<select></select>").attr("name", "smoke-map-county-data-type").append(
        createOption("smoke", "Smoke Data"),
        createOption("population", "Population Data")
      )
    )
    var stateDataTypeOptions = [];
    $.each(["sw1", "sw6", "length", "intensity", "index"], function(i, key) {
      stateDataTypeOptions.push(createOption(key, KEY_TO_NAME[key]));
    });
    var stateOptions = $(newDiv).attr("id", "smoke-map-state-options").append(
      document.createTextNode("Data: "),
      $("<select></select>").attr("name", "smoke-map-state-data-type").append(
        stateDataTypeOptions
      ),
      document.createTextNode("· Sort: "),
      $("<select></select>").attr("name", "smoke-map-state-data-sort").append(
        createOption("diff", "Difference"),
        createOption("present", "Present"),
        createOption("future", "Future"),
        createOption("fips", "FIPS code")
      )
    );
    dataC.append(
      $("<p></p>").addClass("smoke-map-head").text("Smoke Wave Map: View Data"),
      countyOptions,
      stateOptions,
      $(newDiv).attr("id", "smoke-map-data")
    )
    // Legend container
    i = 0;
    while (i < 9) {
      // 8 legend containers for colors
      legendC.append($(newDiv).addClass("color-block color-"+i)
        .append($(newDiv).addClass("text")));
      i++;
    }
    root.append($(newDiv).attr("id", "smoke-map-tooltip"),
      controlC, dataC, legendC);
    $("#smoke-map-container").append(root);
  }

  /* Creates an <input> with type radio, and given values */
  function createRadio(name, dataVal, checked) {
    return $("<input type='radio'/>")
      .attr("name", "smoke-map-"+name)
      .attr("data-"+name, dataVal)
      .attr("checked", checked)
  }

  /* Creates an <option> element */
  function createOption(val, text) {
    return $("<option></option>").attr("value", val).text(text);
  }

  /*
   * Switches between viewing data and not viewing data. Called VIEW.dataView
   * is changed.
   */
  function adjustView() {
    $("#smoke-map-county-options").addClass("hidden");
    $("#smoke-map-state-options").addClass("hidden");
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
    removeClass($("path.selected"), "selected");
  }

  /*
   * Makes the labels for the state layer. Uses the 'abbr' attribute of each
   * element. Calculates center of shape, but special cases some oddly-shaped
   * states.
   */
  function makeStateLabels() {
    $("#states path").each(function(i, p) {
      var abbr = $(p).attr("abbr");
      var center = findPathCenter(p);
      var label = document.createElementNS("http://www.w3.org/2000/svg",'text');
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
    var c = $(elem).attr("class") || "";
    if (newClass && (c.indexOf(newClass) === -1)) { // Not already added
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
    var cs = $(elem).attr("class") || "";
    cs = cs.split(" ");
    var i = cs.indexOf(rmClass);
    if (i !== -1) {
      cs.splice(i, 1);
    }
    $(elem).attr("class", cs.join(" "));
  }
}