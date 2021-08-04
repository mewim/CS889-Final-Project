<template>
  <div id="similarity-view" style="width:100%;height:100%;">
    <div id="song-card" 
      style="position:absolute;bottom:0px;padding-bottom:1.25rem;width:fit-content;height:fit-content;display: none; z-index: 5;">
      <b-card style="width: 30rem;background-color:#f8f8f8;" class="mb-2">
        <b-card-title id="song-title" style="text-transform: capitalize;">
          Card Title
        </b-card-title>
        <b-card-text id="song-body">
          Some quick example text to build on the card title and make up the bulk of the card's content.
        </b-card-text>
        <iframe
          type="text/html"
          style="width:27.5em;height:15.46em;"
          :src="currentSongUrl"
          frameborder="0"
          allow="autoplay"
          allowfullscreen="allowfullscreen"
          mozallowfullscreen="mozallowfullscreen" 
          msallowfullscreen="msallowfullscreen" 
          oallowfullscreen="oallowfullscreen" 
          webkitallowfullscreen="webkitallowfullscreen"
          id="similarity-youtube-player"
        ></iframe>
      </b-card>
    </div>
    <div id="nearby-card" 
      style="position:absolute;width:fit-content;height:fit-content;display: none; z-index: 4;">
      <b-card style="width: 30em;background-color:#f8f8f8;" class="mb-2">
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
    <div id="selection-card" style="right:0px; top:0px;position:absolute;width:fit-content: height: fit-content; z-index:3;">
      <b-card style="width: 15em;background-color:#f8f8f8;" class="mb-2">
        <b-card-title id="selection-title" style="text-transform: capitalize;">
          Select Attributes
        </b-card-title>
        <b-card-text id="select-body" style="text-transform: capitalize;">
          <b-form-checkbox-group switches v-model="selectedAttrs" :state="state">
            <b-form-checkbox switch value="danceability" name="danceability"> danceability </b-form-checkbox>
            <b-form-checkbox switch value="energy" name="energy"> energy </b-form-checkbox>
            <b-form-checkbox switch value="speechiness" name="speechiness"> speechiness </b-form-checkbox>
            <b-form-checkbox switch value="acousticness" name="acousticness"> acousticness </b-form-checkbox>
            <b-form-checkbox switch value="instrumentalness" name="instrumentalness"> instrumentalness </b-form-checkbox>
            <b-form-checkbox switch value="liveness" name="liveness"> liveness </b-form-checkbox>
            <b-form-checkbox switch value="valence" name="valence"> valence </b-form-checkbox>
            <b-form-invalid-feedback :state="state">Please select at least three</b-form-invalid-feedback>
            <b-form-valid-feedback :state="state">Selected at least three</b-form-valid-feedback>
          </b-form-checkbox-group><br>
          <b-button id="recompute" v-on:click="replot" :disabled="selectedAttrs.length < 3">Recompute</b-button>
        </b-card-text>    
      </b-card>
    </div>
    <div id="spinner" style="position: absolute; width:fit-content;height:fit-content;z-index:6; display:none;">
      <b-card style="width: 15em;" class="mb-2">
        <img src="/loading2.gif" style="width:12.5em;"/>
      </b-card>
    </div>
    <svg style="position:absolute;width:100%;height:100%;"></svg>

  </div>
</template>

<script>
import * as d3 from "d3";
import * as axios from "axios";
import * as stringSimilarity from "string-similarity";
import * as clustering from "density-clustering";

export default {
  name: "SimilarityView",
  data() {
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
      currentSongUrl: "",
      selectedAttrs: [
        "danceability", "energy", "speechiness", "acousticness", "instrumentalness", "liveness", "valence"
      ],
      originalAttrs: [
        "danceability", "energy", "speechiness", "acousticness", "instrumentalness", "liveness", "valence"
      ],
    };
  },
  mounted: async function () {
    await setTimeout(function() {}, 1000);
    var parentDiv = document.getElementById("similarity-view");
    this.width = parentDiv.clientWidth;
    this.height = parentDiv.clientHeight;
    d3.select("#spinner").style("left", (this.width/2-128).toString()+"px")
      .style("top", (this.height/2-128).toString()+"px")
      .style("display", "inline");
    // use event bus for this? (todo)
    d3.select("#spinner2").style("left", (this.width/2-128).toString()+"px")
      .style("top", (this.height/2-128).toString()+"px");
  },
  created: async function () {},
  methods: {
    tabLoaded: async function () {
      if (this.rendered) {
        return;
      }
      await this.loadData(this.getData(60));
      this.maxValue = this.songData.length;
      d3.select("#spinner").style("display", "none");
      this.draw2DPlot();
      this.rendered = true;
    },
    replot: async function() {
      this.currentSongUrl = "";
      d3.select("#spinner").style("display", "inline");
      d3.select('svg').html("");
      d3.select("#nearby-card").style("display", "none");
      d3.select("#song-card").style("display", "none");
      await this.loadData(this.getData(60));
      d3.select("#spinner").style("display", "none");
      this.draw2DPlot();
    },
    loadData: async function(data) {
      var tracks = await data;
      console.log("data received", tracks);
      var songPoints = [];
      this.songNames = [];
      this.songData = [];
      this.xMin = Number.POSITIVE_INFINITY; 
      this.xMax = Number.NEGATIVE_INFINITY; 
      this.yMin = Number.POSITIVE_INFINITY; 
      this.yMax = Number.NEGATIVE_INFINITY; 
      for (let i = 0; i < tracks.length; ++i) {
        this.songNames.push(tracks[i].info.name);
        this.songData.push({
          id: i,
          songId: tracks[i].info._id,
          x: tracks[i].dim_1, y: tracks[i].dim_2, c: -1,
          p: tracks[i].info.popularity,
          name: tracks[i].info.name,
          artists: tracks[i].info.original_artists.join(", "),
          date: tracks[i].info.release_date.split("-")[0],
        });
        songPoints.push([tracks[i].dim_1, tracks[i].dim_2]);
        this.xMin = Math.min(this.xMin, tracks[i].dim_1);
        this.yMin = Math.min(this.yMin, tracks[i].dim_2);
        this.xMax = Math.max(this.xMax, tracks[i].dim_1);
        this.yMax = Math.max(this.yMax, tracks[i].dim_2);
        // this.maxPopularity = Math.max(this.maxPopularity, tracks[i].popularity);
      }
      this.xMin -= this.margin; this.yMin -= this.margin;
      this.xMax += this.margin; this.yMax += this.margin;
      var kmeans = new clustering.KMEANS();
      var clusters = kmeans.run(songPoints, 10);
      // console.log(clusters, clusters.map((x) => x.length).reduce((a, b) => a + b, 0));
      // var cnt = 0;
      for (let i = 0; i < 10; ++i) {
        for (let j = 0; j < clusters[i].length; ++j) {
          this.songData[clusters[i][j]].c = i;
          // cnt++;
        }
      }
      // console.log(cnt);
    },
    getData: async function(popularity) {
      var vueinstance = this;
      this.selectedAttrs.sort(function(a, b){  
        return vueinstance.originalAttrs.indexOf(a) - vueinstance.originalAttrs.indexOf(b);
      });
      console.log(`/api/track/combination/${this.selectedAttrs.join(",")}/${popularity}`);
      const results = await axios
        .get(`/api/track/combination/${this.selectedAttrs.join(",")}/${popularity}`, {})
        .then((res) => res.data);
      return results;
    },
    draw2DPlot: async function() {
      console.log("drawing");
      var vueinstance = this; 
      const handler = d3.zoom().scaleExtent([1, 5]).on("zoom", updateChart);

      var svg = d3.select("svg").call(handler);
      var x = d3.scaleLinear().range([0, this.width]).domain([this.xMin, this.xMax]);
      var y = d3.scaleLinear().range([this.height, 0]).domain([this.yMin, this.yMax]);
      var c = d3.scaleSequential(d3.interpolateRainbow);
      var p = d3.scaleLinear().range([60, 100]).domain([1, 5]);
    
      this.gDot = svg.append('g');

      this.gDot.selectAll("dot").data(this.songData)
      .enter()
      .append("circle")
      .attr("class", function(d) { return "circ-"+d.id.toString() } )
      .attr("cx", function (d) { return x(d.x); } )
      .attr("cy", function (d) { return y(d.y); } )
      .attr("r", 5)
      .attr("data-popularity", function(d) { return d.p })
      .attr("data-cluster", function(d) { return d.c })
      .style("fill", function (d) { return c((d.c)/9.0) })
      .style("opacity", Math.random()*0.3+0.4)
      .attr("display", function(d) { return (d.p >= 140 - p(1.0)) ? "inline" : "none" })
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
          .style("stroke-width", 3) //*vueinstance.scale)
          .style("stroke", "black");
        processNearbySongs(d, vueinstance);
        const params = new URLSearchParams([["name", d.name+" "+d.artists]]);
        const results = await axios
          .get(`/api/track`, { params })
          .then((res) => res.data);
        var names = results.map((k) => k.name);
        var matches1 = stringSimilarity.findBestMatch(d.name, names);
        var matches2 = stringSimilarity.findBestMatch(d.name+" "+
          d.artists, names);
        
        if (matches1.bestMatchIndex == matches2.bestMatchIndex &&
            matches1.bestMatch.rating >= 0.3 && matches2.bestMatch.rating >= 0.3) {
          d3.select("#similarity-youtube-player").style("display", "inline");
          const res = await axios.get(`/api/track/${results[matches1.bestMatchIndex]._id}/youtube-url`);
          const url = res.data.url;
          vueinstance.currentSongUrl = url;
          console.log('found');
        } else {
          console.log('did not find');
          vueinstance.currentSongUrl = "";
          d3.select("#similarity-youtube-player").style("display", "none");
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
        vueinstance.gDot
        .selectAll('circle')
        .attr("cx", function (d) { return newX(d.x); } )
        .attr("cy", function (d) { return newY(d.y); } )
        .attr("r", 5) //*d3.event.transform.k)
        .attr("display", function(d) { 
          return (d.p >= (140 - p(d3.event.transform.k))) ? "inline" : "none" 
        });
        if (vueinstance.currSelected && vueinstance.currSelected != -1) {
          d3.select(".circ-"+vueinstance.currSelected.toString()).style("stroke-width", 3); //*d3.event.transform.k);
        }
      }
    },
  },
  computed: {
    state() {
      return this.selectedAttrs.length >= 3;
    },
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
</style>
