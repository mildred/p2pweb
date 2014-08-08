var moment = require("./../moment/min/moment-with-locales.js");

function updateMoment(){
  var times = document.querySelectorAll("time.updated.momentFromNow[datetime]");
  for(var i = 0; i < times.length; i++) {
    var time = times[i];
    time.textContent = moment(time.getAttribute("datetime")).fromNow();
  }
}

updateMoment();
setInterval(updateMoment, 10000);
