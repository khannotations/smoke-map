function smokeMapCover() {
  $("#smoke-map-cover-password").on("keypress", function(e) {
    if (e.which == 13 && $(this).val()) {
      if ($(this).val() === "smokewavemap15") {
        $("#smoke-map-cover").addClass("hidden");
      } else {
        alert("Password incorrect");
      }
    }
  });
}