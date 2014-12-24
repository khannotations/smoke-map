# Smoke Wave Data Map Modification Instructions

By Rafi Khan, Winter 2014  

*Note: This is a Markdown file. You can view it nicely by pasting it into a Markdown viewer site like [dillinger.io](http://dillinger.io/)*

### General Notes

The smoke wave map starts with an HTML file called `index.html`, which contains the code for the sidebar and the container for the map. Everything else is generated via Javascript, in the file `scripts/script.js`.  The stylesheet is written with SASS, and is in `src/style.scss`. The compiled stylesheet that is included in `index.html` is in `style/style.css`. It is **not advised** to edit this `.css` file.  The map pulls all of its data from the `data` directory. 

### Data

All data used by the map lives in the `data` directory. `countries.json` and `states.json` are GeoJSON files found at [eric.clst.org/Stuff/USGeoJSON](http://eric.clst.org/Stuff/USGeoJSON), with slight modifications. `all_sw.json` is the file with all the smoke wave data.  

The `all_sw.json` file must be formatted as an array of objects that contain all the data for that county. Each object must have at least the `"FIPS"`, `"COUNT"` and `"STATE"`, properties. It looks like this:

    [
      {
        "STATE": "ID",
        "COUNTY": "Ada County",
        "FIPS": "16001",
        ... some more meta data like sq. miles, etc.
        "Future_length":"3.08",
        "Future_intensity":"15.69",
        ... all other data fields
      },
      {
        "STATE": "ID",
        ... etc.
      }
    ]

##### Editing the data

The easiest way to edit the data is to start with an Excel spreadsheet where the column names are the data keys (for example `"STATE"`, `"FIPS"`, and `"Future_length"`), like `data/all_data.xlsx`. Then, export that file as a CSV; it should look like `all_data.csv`. Next, paste the CSV into a CSV to JSON converter like [codebeautify.org/csv-to-xml-json](http://codebeautify.org/csv-to-xml-json), convert to JSON and replace all the content in `all_sw.json`. **Note that as of this writing, the column name for PD_seasonLength is misspelled, and must be corrected for the site to work**.

If you'd like to add new data fields, the `scripts/script.js` file must be updated to reflect the new keys. Place the field names in the `KEYS` array, in either the `present` or `future` category, and also make sure to add the canonical name to the `KEYS_TO_NAMES` object.

### Javascript 

The map depends on 4 libraries: jQuery, Underscore.js (for data manipulation), Polymaps.js (for the map), and Highcharts.js (for the charts). The rest of the code (commented) is in the file `scripts/script.js`. 

### Styling

Styling is done through SASS css. To write and compile your own SASS code, first download SASS. Then change to the site directory in Terminal and run `sass --watch src:style`. Any changes you make in `src/style.scss` will automatically be reflected in `style/style.css`. 

##### Changing the colors

The colors for the map are stored in variables at the top of `style.scss`. Changing those variables will change the colors everywhere, in the map and in the legend.