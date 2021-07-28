<template>
  <div id="similarity-view">
    <div id="song-card" 
      style="position:absolute;bottom:0px;padding-bottom:1.25rem;width:fit-content;height:fit-content;display: none;">
      <b-card style="width: 30rem;" class="mb-2">
        <b-card-title id="song-title" style="text-transform: capitalize;">
          Card Title
        </b-card-title>
        <b-card-text id="song-body">
          Some quick example text to build on the card title and make up the bulk of the card's content.
        </b-card-text>
        <!-- <SpotifyPlayer
          :token="currentWebPlayerToken"
          :uris="currentURI" /> -->
        <iframe
          type="text/html"
          style="width:27.5em;height:15.46em;"
          :src="currentSongUrl"
          frameborder="0"
          allow="autoplay"
        ></iframe>
      </b-card>
    </div>
    <div id="nearby-card" 
      style="position:absolute;width:fit-content;height:fit-content;display: none;">
      <b-card style="width: 30em;" class="mb-2">
        <b-card-title id="nearby-title" style="text-transform: capitalize;">
          Nearby Songs
        </b-card-title>
        <b-card-text id="nearby-body" style="text-transform: capitalize;">
          Select a song to see nearby songs.
        </b-card-text>
        <b-card-text>
          <!--b-progress :value="currValue" :max="maxValue" class="mb-3"></b-progress-->
        </b-card-text>     
      </b-card>
    </div>
  </div>
</template>

<script>
import * as d3 from "d3";
import * as axios from "axios";
import * as qs from "qs";
// import SpotifyPlayer from 'react-spotify-web-playback';
import * as stringSimilarity from "string-similarity";

export default {
  name: "SimilarityView",
  // components: {
  //   SpotifyPlayer,
  // },
  data() {
    // get web API token here: https://react-spotify-web-playback.gilbarbara.dev/
    // unfortunately this token is valid for 1 hour
    return {
      songNames: [],
      songData: [],
      rendered: false,
      xMin: Number.POSITIVE_INFINITY, 
      xMax: Number.NEGATIVE_INFINITY, 
      yMin: Number.POSITIVE_INFINITY, 
      yMax: Number.NEGATIVE_INFINITY, 
      margin: 10,
      width: -1,
      height: -1,
      currValue: 0,
      maxValue: 0,
      currSelected: -1,
      scale: 1.0,
      spotifyToken: "",
      currentWebPlayerToken: "BQB0WYTfr1SfyU6aUUq24fpZ3FyVKCnlINFSe-Byze206ry5fGshbp3-ytNDB0TG5wc8VMAfg02fI3dlbP0ImgtV8NK5ThaY-Q0MeqplLMosFne_lPyywTqCFugImYnrTc55LWrDIlYWPW8y04SBelsE7zfePDl79qk4zuZ5c6HgCRZgAwnyb-vwbA2F",
      currentURI: "",
      currentSongUrl: "",
    };
  },
  mounted: async function () {},
  methods: {
    tabLoaded: async function () {
      if (this.rendered) {
        return;
      }
      await this.loadData();
      var parentDiv = document.getElementById("similarity-view");
      this.width = parentDiv.clientWidth;
      this.height = parentDiv.clientHeight;
      this.maxValue = this.songData.length;
      this.draw2DPlot();
      this.rendered = true;
    },
    loadData: async function() {
      const tracks = await d3.csv("/tracks10k.csv");

      for (let i = 0; i < tracks.length; ++i) {
        this.songNames.push(tracks[i].name);
        this.songData.push({
          id: i,
          x: tracks[i].x, y: tracks[i].y, c: tracks[i].c, p: tracks[i].popularity,
          name: tracks[i].name,
          artists: tracks[i].artists.replaceAll("'", "").replaceAll("[", "").replaceAll("]", ""),
          date: tracks[i].release_date.split("-")[0],
        });
        this.xMin = Math.min(this.xMin, tracks[i].x);
        this.yMin = Math.min(this.yMin, tracks[i].y);
        this.xMax = Math.max(this.xMax, tracks[i].x);
        this.yMax = Math.max(this.yMax, tracks[i].y);
        // this.maxPopularity = Math.max(this.maxPopularity, tracks[i].popularity);
      }
      this.xMin -= this.margin; this.yMin -= this.margin;
      this.xMax += this.margin; this.yMax += this.margin;
    },
    connectToSpotify: async function() {
      var client_id = '8518baec4d274639ae796ad25b1e6d51'; // Your client id
      var client_secret = 'ae6f30af0d804fb3a0a4e7a534f0f90e'; // Your secret

      // https://gist.github.com/donstefani/70ef1069d4eab7f2339359526563aab2
      try {
        const response = await axios.post(
          'https://accounts.spotify.com/api/token',
          qs.stringify({
            grant_type: 'client_credentials',
          }),
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            auth: {
              username: client_id,
              password: client_secret,
            },
          });
        this.spotifyToken = response.data.access_token;
        return response;
      } catch (error) {
        console.log(error);
      }
    },
    getFirstTrack: async function(q) {
      //console.log(this.spotifyToken, q);
      axios.defaults.headers.common = {'Authorization': `Bearer ${this.spotifyToken}`}
      try {
        const response = await axios.get(
          "https://api.spotify.com/v1/search",
          {
            params: {
              'q': q,
              'type': "track",
              'market': "US",
            }
          },
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          });
        return response.data.tracks.items[0].uri;
      } catch (error) {
        console.log(error);
      }
    },
    draw2DPlot: async function() {
      var vueinstance = this; 
      const handler = d3.zoom().scaleExtent([1, 5]).on("zoom", updateChart);

      var svg = d3.select('#similarity-view').append("svg").attr("width", "100%").attr("height", "100%").call(handler);
      var x = d3.scaleLinear().range([0, this.width]).domain([this.xMin, this.xMax]);
      var y = d3.scaleLinear().range([this.height, 0]).domain([this.yMin, this.yMax]);
      var c = d3.scaleSequential(d3.interpolateTurbo);
      var p = d3.scaleLinear().range([0, 25]).domain([1, 5]);

    
      var gDot = svg.append('g');
      gDot
      .selectAll("dot")
      .data(this.songData)
      .enter()
      .append("circle")
      .attr("class", function(d) { return "circ-"+d.id.toString() } )
      .attr("cx", function (d) { return x(d.x); } )
      .attr("cy", function (d) { return y(d.y); } )
      .attr("r", 5)
      .style("fill", function (d) { return c((d.c-1)/99.0) })
      .attr("display", function(d) { return (d.p >= (25 - p(1.0))) ? "inline" : "none" })
      .on("click", async function(d) {
        if (vueinstance.currSelected && vueinstance.currSelected != -1) {
          d3.select(".circ-"+vueinstance.currSelected.toString()).style("stroke", "none");
        }
        vueinstance.currSelected = d.id;
        d3.select("#song-title").text(d.name);
        d3.select("#song-body").html("<b>Artists:</b> "+d.artists+"<br/><b>Release:</b> "+d.date);
        d3.select("#song-card").style("display", "inline");
        d3.select("#nearby-card").style("display", "inline");
        d3.select("#nearby-progress").style("display", "inline");
        d3.select(".circ-"+vueinstance.currSelected.toString())
          .style("stroke-width", 3*vueinstance.scale).style("stroke", "black");
        processNearbySongs(d, vueinstance);
        // vueinstance.connectToSpotify().then(async function() {
        //   var trackURI = await vueinstance.getFirstTrack(d.name+" "+d.artists);
        //   vueinstance.currentURI = trackURI;
        // });
        const params = new URLSearchParams([["name", d.name+" "+d.artists]]);
        const results = await axios
          .get(`/api/track`, { params })
          .then((res) => res.data);
        var names = results.map((k) => k.name);
        var matches1 = stringSimilarity.findBestMatch(d.name, names);
        var matches2 = stringSimilarity.findBestMatch(d.name+" "+
          d.artists.replaceAll("'", "").replaceAll("[", "").replaceAll("]", ""), names);
        
        if (matches1.bestMatchIndex == matches2.bestMatchIndex &&
            matches1.bestMatch.rating >= 0.3 && matches2.bestMatch.rating >= 0.3) {
          d3.select("iframe").style("display", "inline");
          const res = await axios.get(`/api/track/${results[matches1.bestMatchIndex]._id}/youtube-url`);
          const url = res.data.url;
          vueinstance.currentSongUrl = url;
        } else {
          vueinstance.currentSongUrl = "";
          d3.select("iframe").style("display", "none");
        }
      });
      
      async function processNearbySongs(d, v) {
        var mem = [];
        // console.log(d);
        var x = d.x, y = d.y;
        for (var j = 0; j < v.songData.length; ++j) {
          // v.currValue++; 
          // await setTimeout(function(){ v.currValue++; }, 20);
          var cx = v.songData[j].x, cy = v.songData[j].y;
          mem.push([v.songData[j].id, Math.sqrt((cx-x)**2+(cy-y)**2)]);
        }
        // Sort the array based on the second element
        mem.sort(function(first, second) {
          return first[1] - second[1];
        });
        var elements = "<ul>";
        for (j = 1; j <= 5; ++j) {
          elements += "<li>" + v.songData[mem[j][0]].name;
        }
        elements +="</ul>"
        d3.select("#nearby-body").html(elements);
      }

      function updateChart() {
        vueinstance.scale = d3.event.transform.k;
        var newX = d3.event.transform.rescaleX(x);
        var newY = d3.event.transform.rescaleY(y);
        gDot
        .selectAll('circle')
        .attr("cx", function (d) { return newX(d.x); } )
        .attr("cy", function (d) { return newY(d.y); } )
        .attr("r", 5*d3.event.transform.k)
        .attr("display", function(d) { 
          return (d.p >= (25 - p(d3.event.transform.k))) ? "inline" : "none" 
        });
        if (vueinstance.currSelected && vueinstance.currSelected != -1) {
          d3.select(".circ-"+vueinstance.currSelected.toString()).style("stroke-width", 3*d3.event.transform.k);
        }
      }

    },
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
</style>
