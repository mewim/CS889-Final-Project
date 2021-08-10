<template>
  <div id="similarity-view" style="width:100%;height:100%;">
    <div id="song-card" 
      style="position:absolute;bottom:0px;padding-bottom:1.25rem;width:fit-content;height:fit-content;display: none; z-index: 5;">
      <b-card style="width: 30rem;background-color:#f8f8f8;max-height: 55vh; overflow-y:auto;" class="mb-2">
        <b-card-title id="song-title" style="text-transform: capitalize;">
          Card Title
        </b-card-title>
        <b-card-text id="song-body">
          <b>Artists:</b> <span v-for="(artist, key) in track.artists" :key="key">
            <a href="#" @click.prevent="jumpToCollaboration(artist._id)">
              {{ artist.name }}
            </a><span v-if="key + 1 !== track.artists.length">, </span>
          </span><br>
          <b>Release:</b> <a href="#" @click.prevent="jumpToTimeline(track.songId)">
            {{ String(track.date) }}
          </a><br>
          <b>Genre:</b> {{ String(track.genre) }}
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
      <b-card style="width: 30em;background-color:#f8f8f8;max-height: 40vh; overflow-y:auto;" class="mb-2">
        <b-card-title id="nearby-title" style="text-transform: capitalize;">
          Nearby Songs
        </b-card-title>
        <b-card-text id="nearby-body" style="text-transform: capitalize;">
          <ul>
            <li v-for="item in nearbysongs" v-bind:key="item.song">
              <a style="cursor:pointer;" :class="item" v-on:click="navigateToPoint(item.coords)">{{ item.song }}</a>
            </li>
          </ul>
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
          <b-button id="recompute" v-on:click="replot(currSelectedSongId)" :disabled="selectedAttrs.length < 3 || loadingData">Recompute</b-button><br><br>
          <b-button v-b-toggle.sidebar-right :disabled="loadingData">Histograms</b-button><br><br>
          <b-button id="random" v-on:click="randomSong" :disabled="loadingData">Random</b-button>   
        </b-card-text>    
      </b-card>
    </div>
    <div id="spinner" style="position: absolute; width:fit-content;height:fit-content;z-index:6; display:none;">
      <b-card style="width: 15em;" class="mb-2">
        <img src="/loading2.gif" style="width:12.5em;"/>
      </b-card>
    </div>
    <svg style="position:absolute;width:100%;height:100%;"></svg>
    <b-sidebar backdrop id="sidebar-right" width="70%" title="Histograms" right shadow>
      <div style="padding:1.25em;" id="histograms">
      </div>
      <div style="padding-left:2.5em;" id="coordinates">
      </div><br>
      <div style="padding-left:2.5em;">
        <b-button v-b-toggle.sidebar-right :disabled="loadingData" v-on:click="navigateToPoint(currentCoords)">Navigate</b-button>
      </div>
    </b-sidebar>
  </div>
</template>

<script>
import * as d3 from "d3";
import * as axios from "axios";
import * as stringSimilarity from "string-similarity";
import * as clustering from "density-clustering";
import EventBus from "../EventBus";
import Events from "../Events";
import genres from "../genres";


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
      currSelectedSongId: -1,
      scale: 1.0,
      currentSongUrl: "",
      selectedAttrs: [
        "danceability", "energy", "speechiness", "acousticness", "instrumentalness", "liveness", "valence"
      ],
      originalAttrs: [
        "danceability", "energy", "speechiness", "acousticness", "instrumentalness", "liveness", "valence"
      ],
      loadingData: false,
      mainZoom: null,
      mainSvg: null,
      mainScales: {},
      sideScales: {},
      currentCoords: null,
      drawnX: {},
      nearbysongs: null,
      track: {
        "info": {
          "artists": [
            {"name": "A", "id": "1234"},
          ]
        }
      },
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
    tabLoaded: async function (newTrackId=null) {
      console.log("loading SimilarityView: " + newTrackId);
      if (this.rendered && this.currSelectedSongId === newTrackId) {
        return;
      }
      this.replot(newTrackId);
      this.rendered = true;
    },
    replot: async function(newTrackId=null) {
      this.currentSongUrl = "";
      d3.select("#spinner").style("display", "inline");
      d3.select('svg').html("");
      d3.select("#nearby-card").style("display", "none");
      d3.select("#song-card").style("display", "none");
      this.loadingData = true;
      var randomIndex = await this.loadData(this.getData(60), newTrackId);
      this.loadingData = false;
      this.sideScales = {};
      this.maxValue = this.songData.length;
      d3.select("#histograms").html("");
      for (let attrid = 0; attrid < this.selectedAttrs.length; ++attrid) {
        this.plotHistogram(this.selectedAttrs[attrid]);
      }
      d3.select("#spinner").style("display", "none");
      await this.draw2DPlot();
      this.drawnX = {};
      if (newTrackId===null) {
        randomIndex = Math.floor(Math.random() * (2000-1 + 1) + 1);
      }
      this.track = this.songData[randomIndex];
      this.setSong(this.track.songId);
      this.currSelectedSongId = this.track.songId;
      this.navigateToPoint(this.parseCoords(this.getCoords(this.songData[randomIndex])));
    },
    randomSong: function() {
      var randomIndex = Math.floor(Math.random() * (2000-1 + 1) + 1);
      this.track = this.songData[randomIndex];
      this.setSong(this.track.songId);
      this.navigateToPoint(this.parseCoords(this.getCoords(this.songData[randomIndex])));
    },
    loadData: async function(data, newTrackId) {
      var randomIndex;
      var tracks = await data;
      console.log("data received", tracks);
      var songPoints = [];
      this.songNames = [];
      this.songData = [];
      this.xMin = Number.POSITIVE_INFINITY; 
      this.xMax = Number.NEGATIVE_INFINITY; 
      this.yMin = Number.POSITIVE_INFINITY; 
      this.yMax = Number.NEGATIVE_INFINITY; 
      var doesnotexist = true;
      for (let i = 0; i < tracks.length; ++i) {
        if (newTrackId === tracks[i].info._id) {
          doesnotexist = false;
          randomIndex = i;
        }
        var artists = [];
        for (let j = 0; j < tracks[i].info.original_artists.length; ++j) {
          artists.push({
            name: tracks[i].info.original_artists[j],
            _id: tracks[i].info.artists_id[j],
          })
        }
        this.songNames.push(tracks[i].info.name);
        this.songData.push({
          id: i,
          songId: tracks[i].info._id,
          x: tracks[i].dim_1, y: tracks[i].dim_2, c: -1,
          genre: tracks[i].info.genre,
          p: tracks[i].info.popularity,
          name: tracks[i].info.name,
          artists: artists,
          date: tracks[i].info.release_date.split("-")[0],
          danceability: tracks[i].info.danceability,
          energy: tracks[i].info.energy,
          speechiness: tracks[i].info.speechiness,
          acousticness: tracks[i].info.acousticness,
          instrumentalness: tracks[i].info.instrumentalness,
          liveness: tracks[i].info.liveness,
          valence: tracks[i].info.valence,
        });
        songPoints.push([tracks[i].dim_1, tracks[i].dim_2]);
        this.xMin = Math.min(this.xMin, tracks[i].dim_1);
        this.yMin = Math.min(this.yMin, tracks[i].dim_2);
        this.xMax = Math.max(this.xMax, tracks[i].dim_1);
        this.yMax = Math.max(this.yMax, tracks[i].dim_2);
        // this.maxPopularity = Math.max(this.maxPopularity, tracks[i].popularity);
      }
      console.log(newTrackId, doesnotexist);
      if (newTrackId!==null && doesnotexist) {
        var results = await axios
        .get(`/api/track/combinationSingle/${this.selectedAttrs.join(",")}/${newTrackId}`, {})
        .then((res) => res.data);
        randomIndex = tracks.length;
        results = results[0];
        var artists2 = [];
        for (let j = 0; j < results.info.original_artists.length; ++j) {
          artists2.push({
            name: results.info.original_artists[j],
            _id: results.info.artists_id[j],
          })
        }
        this.songNames.push(results.name);
        this.songData.push({
          id: tracks.length,
          songId: results.info._id,
          x: results.dim_1, y: results.dim_2, c: -1,
          p: 60,
          genre: results.info.genre,
          name: results.info.name,
          artists: artists2,
          date: results.info.release_date.split("-")[0],
          danceability: results.info.danceability,
          energy: results.info.energy,
          speechiness: results.info.speechiness,
          acousticness: results.info.acousticness,
          instrumentalness: results.info.instrumentalness,
          liveness: results.info.liveness,
          valence: results.info.valence,
        });
        songPoints.push([results.dim_1, results.dim_2]);
        this.xMin = Math.min(this.xMin, results.dim_1);
        this.yMin = Math.min(this.yMin, results.dim_2);
        this.xMax = Math.max(this.xMax, results.dim_1);
        this.yMax = Math.max(this.yMax, results.dim_2);         
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
      return randomIndex;
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
    plotHistogram: function(attr) {
      var histograms = d3.select("#histograms");

      var margin = {
        top: 0.005*this.width, 
        right: 0.015*this.width, 
        bottom: 0.03*this.width,
        left: 0.02*this.width
      };
      var width = 0.15*this.width-margin.left-margin.right;
      var height = 0.15*this.width-margin.top-margin.bottom;
      this.sideScales['w'] = width;
      this.sideScales['h'] = height;
      this.sideScales['m'] = margin;

      // append the svg object to the body of the page
      var svg = histograms
        .append("svg")
          .attr("width", width+margin.left+margin.right)
          .attr("height", height+margin.top+margin.bottom)
          .attr("id", "svg-"+attr)
          .style("border", "1px solid")
          .style("margin", (0.01*this.width).toString()+"px")
        .append("g")
          .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

      // X axis: scale and draw:
      var x = d3.scaleLinear()
          .domain([0, 1]) 
          .range([0, width]);
      this.sideScales['x'] = x;
      svg.append("g")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(x));

      // set the parameters for the histogram
      var histogram = d3.histogram()
          .value(function(d) { return d[attr]; })   // I need to give the vector of value
          .domain(x.domain())  // then the domain of the graphic
          .thresholds(x.ticks(50)); // then the numbers of bins

      // And apply this function to data to get the bins
      var bins = histogram(this.songData).slice(0, 50);

      // Y axis: scale and draw:
      var y = d3.scaleLinear()
          .range([height, 0]);
          y.domain([0, d3.max(bins, function(d) { return d.length; })]);   // d3.hist has to be called before the Y axis obviously
      svg.append("g")
          .call(d3.axisLeft(y));

      // append the bar rectangles to the svg element
      svg.selectAll("rect")
          .data(bins)
          .enter()
          .append("rect")
            .attr("x", 1)
            .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; })
            .attr("width", function(d) { return x(d.x1) - x(d.x0) -1 ; })
            .attr("height", function(d) { return height - y(d.length); })
            .style("fill", "#69b3a2")

      svg.append("rect")
        .attr("x", 1)
        .attr("transform", "translate(" + x(0) + "," + y(d3.max(bins, function(d) { return d.length; })) + ")")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "#fff").style("opacity", 0.0);

      var vueinstance = this;
      svg.on("click", function() {
        var x = d3.mouse(this)[0];
        // var y = d3.mouse(this)[1]; 
        var svgid = this.parentNode.id.split("-")[1];
        var j = null;
        for (let i = 0; i < vueinstance.selectedAttrs.length; ++i) {
          if (svgid == vueinstance.selectedAttrs[i]) {
            j = i;
            break;
          }
        }
        vueinstance.currentCoords[j] = vueinstance.sideScales['x'].invert(x);
        d3.select("#coordinates")
          .html("<b>Coordinates</b>: " + vueinstance.currentCoords.map((k) => Math.round(k * 100) / 100).toString() + 
            "<br><b>New Song Point</b>: " + vueinstance.findClosestPoint(vueinstance.currentCoords).name);
        vueinstance.drawnX[svgid]
          .attr("x", vueinstance.sideScales['m'].left+x)
          .attr("y", vueinstance.sideScales['m'].top)
      });

      // text label for the x axis
      svg.append("text")             
      .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (height + margin.top + margin.bottom*0.6) + ")")
      .style("text-anchor", "middle")
      .text(attr);

    },
    getCoords: function(pt) {
      return [
        pt.danceability,
        pt.energy,
        pt.speechiness,
        pt.acousticness,
        pt.instrumentalness,
        pt.liveness,
        pt.valence,
      ];
    },
    parseCoords: function(pt) {
      var ret = [];
      if (this.selectedAttrs.includes("danceability")) {ret.push(pt[0]);}
      if (this.selectedAttrs.includes("energy")) {ret.push(pt[1]);}
      if (this.selectedAttrs.includes("speechiness")) {ret.push(pt[2]);}
      if (this.selectedAttrs.includes("acousticness")) {ret.push(pt[3]);}
      if (this.selectedAttrs.includes("instrumentalness")) {ret.push(pt[4]);}
      if (this.selectedAttrs.includes("liveness")) {ret.push(pt[5]);}
      if (this.selectedAttrs.includes("valence")) {ret.push(pt[6]);}
      return ret;
    },
    euclideanDist: function(v1, v2) {
      var dist = 0;
      for (let i = 0; i < v1.length; ++i) {
        dist += (v1[i]-v2[i])**2
      }
      return Math.sqrt(dist);
    },
    findClosestPoint: function(v) {
      var ptIndex = -1, ptDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < this.songData.length; ++i) {
        var dist = this.euclideanDist(v, this.parseCoords(this.getCoords(this.songData[i])));
        if (dist < ptDist) {
          ptDist = dist;
          ptIndex = i;
        }
      }
      return this.songData[ptIndex];
    },
    navigateToPoint: function(v) {
      var pt = this.findClosestPoint(v);
      var x = this.mainScales['x'](pt.x);
      var y = this.mainScales['y'](pt.y);
      var newScale = this.mainScales['p'].invert(140-pt.p);
      this.mainSvg.transition().duration(2500).call(
        this.mainZoom.transform,
        d3.zoomIdentity.translate(this.width/2, this.height/2).scale(newScale).translate(-x, -y)
      );
      d3.select(".circ-"+pt.id.toString()).dispatch("click");
      this.currentCoords = this.parseCoords(this.getCoords(pt));
      d3.select("#coordinates")
      .html("<b>Coordinates</b>: "+this.currentCoords.map((k) => Math.round(k * 100) / 100));
      this.updateHistograms();
    },
    updateHistograms: function() {
      for (let i = 0; i < this.currentCoords.length; ++i) {
        if (!(this.selectedAttrs[i] in this.drawnX)) {
          this.drawnX[this.selectedAttrs[i]] = d3.select("#svg-"+this.selectedAttrs[i]).append("rect");          
        }
        this.drawnX[this.selectedAttrs[i]]
          .attr("x", this.sideScales['m'].left+this.sideScales['x'](this.currentCoords[i]))
          .attr("y", this.sideScales['m'].top)
          .attr("height", this.sideScales['h'])
          .attr("width", 1)
          .style("stroke-width", "3");
      }
    },
    draw2DPlot: async function() {
      console.log("drawing");
      var vueinstance = this; 
      this.mainZoom = d3.zoom().scaleExtent([1, 5]).on("zoom", updateChart);
      var handler = this.mainZoom;
      this.mainSvg = d3.select("svg").call(handler);
      var svg = this.mainSvg;
      var x = d3.scaleLinear().range([0, this.width]).domain([this.xMin, this.xMax]);
      var y = d3.scaleLinear().range([this.height, 0]).domain([this.yMin, this.yMax]);
      var c = d3.scaleSequential(d3.interpolateRainbow);
      var p = d3.scaleLinear().range([60, 100]).domain([1, 5]);
      this.mainScales['x'] = x;
      this.mainScales['y'] = y;
      this.mainScales['c'] = c;
      this.mainScales['p'] = p;
    
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
      .style("fill", function (d) { return c((genres.indexOf(d.genre)/31.0)) })
      .style("opacity", Math.random()*0.3+0.4)
      .attr("display", function(d) { return (d.p >= 140 - p(1.0)) ? "inline" : "none" })
      .on("click", async function(d) {
        if (vueinstance.currSelected && vueinstance.currSelected != -1) {
          d3.select(".circ-"+vueinstance.currSelected.toString()).style("stroke", "none");
        }
        vueinstance.currSelected = d.id;
        vueinstance.currSelectedSongId = d.songId;
        vueinstance.setSong(d.songId);
        vueinstance.track = vueinstance.songData[d.id];
        d3.select("#song-title").text(d.name);
        // d3.select("#song-body").html("<b>Artists:</b> "+d.artists+"<br/><b>Release:</b> "+d.date);
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
        v.nearbysongs = [];
        for (j = 1; j <= 5; ++j) {
          v.nearbysongs.push({
            song: v.songData[mem[j][0]].name,
            coords: v.parseCoords(v.getCoords(v.songData[mem[j][0]])),
          })
        }
        v.nearbysongs = [...new Set(v.nearbysongs)];
        // var elements = "<ul>";
        // for (j = 1; j <= 5; ++j) {
        //   elements += "<li>" + v.songData[mem[j][0]].name;
        // }
        // elements +="</ul>"
        // d3.select("#nearby-body").html(elements);
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
    jumpToTimeline: function (trackId) {
      EventBus.$emit(Events.JUMP_TO_TIMELINE, trackId);
    },
    jumpToCollaboration: function (artistId) {
      EventBus.$emit(Events.JUMP_TO_COLLABORATION, artistId);
    },
    jumpToSimilarity: function (trackId) {
      EventBus.$emit(Events.JUMP_TO_SIMILARITY, trackId);
    },
    setSong: function (item) {
      EventBus.$emit(Events.SET_SONG, item);
    },
    setArtist: function (item) {
      EventBus.$emit(Events.SET_ARTIST, item);
    }
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
