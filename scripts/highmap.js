$(document).ready(function() {
  var ALL_DATA;
  var COLORS = ["#fafafa", "#70fb5e", "#c3fb68", "#fbf45d", "#fbbb4b", "#fb6b41"]
  var countriesDef = $.getJSON("./data/counties.json");
  var statesDef = $.getJSON("./data/states.json");
  var swDef = $.getJSON("./data/all_sw_highmap.json", function(data) {
    ALL_DATA = data;
  });
  $.when(countriesDef, statesDef, swDef).then(function(counties, states, sw) {
    var a = $("#smoke-map").highcharts('Map', {
      title: {
        align: "left",
        text: "Smoke Wave Data",
      },
      subtitle: {
        align: "left",
        text: "subtitle",
      },
      legend: {
        enabled: true
      },
      plotOptions: {
        map: {
          joinBy: ["FIPS"]
        }
      },
      series: [
        // {
        //   mapData: states[0]
        // },
        {
          data: sw[0],
          mapData: counties[0],
          name: "Country FSRI Index",
          allowPointSelect: true,
          cursor: 'pointer',
        }
      ]
    });
    $("#smoke-map").highcharts().mapZoom(10);
  })
});