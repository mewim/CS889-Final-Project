<template>
  <div>
    <div id="left_bar">
        <b-card-body>
            <b-card-text style="font-weight: 500;">Song attribute on vertical axis:</b-card-text>
            <b-form-select v-model="currentAttr" @change="attributeChanged" >
                <b-form-select-option disabled :value="null">-- Select a song attribute --</b-form-select-option>
                <b-form-select-option v-for="item in attributes" :value="item.field" :key="item.field">
                    {{item.title + (item.unit ? ' (' + item.unit + ')' : '')}}
                </b-form-select-option>
            </b-form-select>
        </b-card-body>
        
        <hr class="my-12" style="margin-left: 8px; margin-right: 8px;"/>
        
        <b-card-body v-show="selectedSong._id">
            <b-card-title>{{selectedSong.name}}</b-card-title>
            <b-card-text>
                <b>Artists: </b>{{selectedSong.artistStr}}<br>
                <b>Release: </b>{{selectedSong.release_year}}<br>
                <b>{{(attributes[currentAttr] || {}).title}}: </b>{{selectedSong[currentAttr] + ' ' + ((attributes[currentAttr] || {}).unit || '')}}<br>
            </b-card-text>
            <div v-show="selectedSong.url">
                <iframe
                    allowfullscreen="allowfullscreen"
                    mozallowfullscreen="mozallowfullscreen" 
                    msallowfullscreen="msallowfullscreen" 
                    oallowfullscreen="oallowfullscreen" 
                    webkitallowfullscreen="webkitallowfullscreen"
                    type="text/html"
                    style="width:100%;"
                    :src="selectedSong.url"
                    frameborder="0"
                    allow="autoplay">
                </iframe>
            </div>
            
        </b-card-body>
    </div>

    <div id="timeline_container">
      <svg id="timeline_view"></svg>
    </div>
  </div>
</template>

<script>
import axios from "axios";
import * as d3 from "d3";

const genres = [...Array(11).keys()];  // temp fix
const songsLimit = 100;

// const width = 1100;
// const height = 670;
// const focusMargins = {top: 40, right: 40, bottom: 160, left: 40};
// const contextMargins = {top: 550, right: 40, bottom: 40, left: 40};
// const focusWidth = width - focusMargins.right - focusMargins.left;
// const focusHeight = height - focusMargins.top - focusMargins.bottom;
// const contextHeight = height - contextMargins.top - contextMargins.bottom;

let width = null;
let height = null;
let focusWidth = null;
let focusHeight = null;
let contextHeight = null;
const focusMargins = {top: 40, right: 40, bottom: null, left: 80};
const contextMargins = {top: null, right: 40, bottom: 40, left: 80};
const focusContextSpace = 40;
const focusContextHeightRatio = 6;

let songDots = null;
let xAxisFocus = null;
let yAxisFocus = null;
let xAxisContext = null;
let xFocusScale = null;
let yFocusScale = null;
let xContextScale = null;
let yContextScale = null;
let colorScale = null;

export default {
  name: "TimelineView",
  data() {
    return {
        rendered: false,
        attributes: [],
        songsData: [],
        currentAttr: 'danceability',
        currentAttrAggs: [],
        selectedSong: {},
        minDate: null,
        maxDate: null,
        startDate: null,
        endDate: null,
        serverRequest: false
    };
  },
  mounted: async function () {},
  methods: {
    tabLoaded: async function () {
      if (this.rendered) {
        return;
      }
      await this.loadInitialData();
      this.plotView();
      this.loadSongsData(0);
      this.rendered = true;
    },
    
    getAttributeAggregations: function (startYear, endYear) {
      const paramsArray = [];
      if (startYear) {
        paramsArray.push(["start", startYear]);
      }
      if (endYear) {
        paramsArray.push(["end", endYear]);
      }
      const params = new URLSearchParams(paramsArray);
      return axios
        .get(`/api/track/aggregation`, { params })
        .then((res) => res.data);
    },
    
    getAttributeAggregationByYear: function (startYear, endYear, attribute) {
        const paramsArray = [
            ["attribute", attribute],
            ["start", startYear],
            ["end", endYear]
        ];
        
        const params = new URLSearchParams(paramsArray);
        return axios
            .get(`/api/track/aggregation-by-year`, { params })
            .then((res) => res.data);
    },
    
    getTopSongs: function (startYear, endYear, limit, attribute) {
      const paramsArray = [
        ["start", startYear],
        ["end", endYear],
        ["limit", limit],
        ["attribute", attribute]
      ];
      
      const params = new URLSearchParams(paramsArray);
      return axios
        .get(`/api/track/top-songs`, { params })
        .then((res) => res.data);
    },
    
    getSongYoutubeUrl: function (songId) {
        return axios
            .get(`/api/track/${songId}/youtube-url`)
            .then((res) => res.data);
    },
    
    loadInitialData: async function () {
        let result = await this.getAttributeAggregations();
        //console.log('Attributes aggregations results:', result);
        let yearInfo = result.release_year;
        this.minDate = new Date("" + yearInfo.min);
        this.maxDate = new Date(yearInfo.max, 11, 31);  // new Date("" + (yearInfo.max+1));
        this.startDate = this.minDate;
        this.endDate = this.maxDate;
        delete result.release_year;
        delete result.count;
        //delete result.genre;
        this.attributes = result;
        //console.log('attributes:', this.attributes);
        
        let aggresult = await this.getAttributeAggregationByYear(yearInfo.min, yearInfo.max, this.currentAttr); 
        //console.log('Current attribute aggregation by year:', aggresult);
        aggresult.forEach((s) => {
            s.year = new Date("" + s.year);
        });
        this.currentAttrAggs = aggresult;
    },
    
    loadSongsData: function (serverRequestDelay) {
        if (this.serverRequest) {
            //console.log('server request already underway!');
            return;
        }
        
        this.serverRequest = true;
        if (songDots) {
            songDots.remove();
            songDots = null;
        }
        
        let self = this; 
        setTimeout(async function() {
            self.serverRequest = false;
            const startYear = self.startDate.toISOString().substring(0,4);
            const endYear = self.endDate.toISOString().substring(0,4);
            //console.log('Server request sent: startYear: ' + startYear + ', endYear: ' + endYear);
            
            const result = await self.getTopSongs(startYear, endYear, songsLimit, self.currentAttr);
            //console.log('Songs data from server:', result);
            self.songsData = result.filter((s) => {
                s.release_date = new Date(s.release_date);
                if ((s.release_date < self.startDate) || (s.release_date > self.endDate))
                    return false;
                return true;
            });
            self.plotSongs();
            
        }, serverRequestDelay)
    },
    
    attributeChanged: async function () {
        //console.log('Attribute changed to:', this.currentAttr);
        this.selectedSong = {};
        const minYear = this.minDate.toISOString().substring(0,4);
        const maxYear = this.maxDate.toISOString().substring(0,4);
        let aggresult = await this.getAttributeAggregationByYear(minYear, maxYear, this.currentAttr); 
        //console.log('New attribute aggregation by year:', aggresult);
        aggresult.forEach((s) => {
            s.year = new Date("" + s.year);
        });
        this.currentAttrAggs = aggresult;
        
        const attrInfo = this.attributes[this.currentAttr];
        yFocusScale.domain([attrInfo.min, attrInfo.max]);
        yContextScale.domain(yFocusScale.domain());
        d3.select('.focus')
            .select('.axis_y')
            .call(yAxisFocus);
            
        d3.select('.context')
            .select('#context_area')
            .datum(this.currentAttrAggs)
            .attr("fill", "#cce5df")
            .attr("stroke", "#69b3a2")
            .attr("stroke-width", 1.5)
            .attr("d", d3.area()
                .x(d => xContextScale(d.year))
                .y0(yContextScale(0))
                .y1(d => yContextScale(d.avg))
            );
            
        this.loadSongsData(0);
    },
    
    plotView: function () {
        const attrInfo = this.attributes[this.currentAttr];
        let parentDiv = document.getElementById("timeline_container");
        width = parentDiv.clientWidth;
        height = parentDiv.clientHeight;
        
        focusWidth = width - focusMargins.left - focusMargins.right;
        let focusContextTotalHeight = height - focusMargins.top - contextMargins.bottom - focusContextSpace;
        focusHeight = ((focusContextHeightRatio) / (focusContextHeightRatio + 1)) * focusContextTotalHeight;
        contextHeight = focusContextTotalHeight - focusHeight;
        focusMargins.bottom = height - focusHeight - focusMargins.top;
        contextMargins.top = height - contextHeight - contextMargins.bottom;
        //console.log('width:', width, ', height:', height, ', focusWidth:', focusWidth, ', focusHeight:', focusHeight, ', contextHeight:', contextHeight);
        //console.log('focusMargins:', focusMargins, ', contextMargins:', contextMargins);
        
        d3.select("#timeline_container")
            .append("div")
            .attr("id", "tooltip")
            .style("visibility", "hidden")
            //.style("opacity", 0)
            .style("position", "absolute")
            .attr("pointer-events", "none")
            //.style("background-color", "white")
            .style("border-radius", "5px")
            .style("padding", "10px")
            .style("color", "#555")
            .style("max-width", "400px")
            .style("text-align", "left")
            .style("font-size", "13px");
        
        const svg = d3.select('#timeline_view')
            .attr("width", width)
            .attr("height", height);
            
        xFocusScale = d3.scaleTime()
            .domain([this.startDate, this.endDate])
            .range([0, focusWidth]);
            
        yFocusScale = d3.scaleLinear()
            .domain([attrInfo.min, attrInfo.max])
            .range([focusHeight, 0]);
            
        xContextScale = d3.scaleTime()
            .domain([this.minDate, this.maxDate])
            .range([0, focusWidth]);
            
        yContextScale = d3.scaleLinear()
            .domain(yFocusScale.domain())
            .range([contextHeight, 0]);
            
        colorScale = d3.scaleSequential(d3.interpolateRainbow)
            .domain(d3.extent(genres));
            
        xAxisFocus = d3.axisBottom(xFocusScale).ticks(d3.timeYear.every(5)).tickSize(-height, 0, 0);
        yAxisFocus = d3.axisLeft(yFocusScale);
        xAxisContext = d3.axisBottom(xContextScale);
        
        const brush = d3.brushX()
            .extent([[0, 0], [focusWidth, contextHeight]])
            .on("brush end", brushedCallback);

        const zoom = d3.zoom()
            .scaleExtent([1, 8])  // can set the minimum higher than 1 to prevent further unzooming
            .translateExtent([[0, 0], [focusWidth, focusHeight]])
            .extent([[0, 0], [focusWidth, focusHeight]])
            .on("zoom", zoomedCallback);
            
        svg.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", focusWidth)
            .attr("height", focusHeight);

        const focus = svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + focusMargins.left + "," + focusMargins.top + ")");
            
        focus.append("g")
            .attr("class", "axis axis_x")
            .attr("transform", "translate(0," + focusHeight + ")")
            .call(xAxisFocus);

        focus.append("g")
            .attr("class", "axis axis_y")
            .call(yAxisFocus);

        const context = svg.append("g")
            .attr("class", "context")
            .attr("transform", "translate(" + contextMargins.left + "," + contextMargins.top + ")");
            
        context.append("path")
            .attr("id", "context_area")
            .datum(this.currentAttrAggs)
            .attr("fill", "#cce5df")
            .attr("stroke", "#69b3a2")
            .attr("stroke-width", 1.5)
            .attr("d", d3.area()
                .x(d => xContextScale(d.year))
                .y0(yContextScale(0))
                .y1(d => yContextScale(d.avg))
            );
            
        context.append("g")
            .attr("class", "axis axis_x")
            .attr("transform", "translate(0," + contextHeight + ")")
            .call(xAxisContext);
            
        context.append("g")
            .attr("class", "brush")
            .call(brush)
            .call(brush.move, xFocusScale.range());  // in order to set the default to a smaller period: [xContextScale(startDate), xContextScale(endDate)]

        focus.append("rect")  // svg
            .attr("class", "zoom")
            .attr("width", focusWidth)
            .attr("height", focusHeight)
            //.attr("transform", "translate(" + focusMargins.left + "," + focusMargins.top + ")")
            .style("cursor", "move")
            .style("fill", "none")
            .style("pointer-events", "all")
            .call(zoom);
            
        let self = this;
        function brushedCallback() {
            const event = d3.event;  // d3 < ver 6.0
            if (!event.sourceEvent || !event.selection) return;
            //console.log('brushed event:', event);
            if (event.sourceEvent && event.sourceEvent.type === "zoom") return;
            let s = event.selection || xContextScale.range();
            //console.log('brushed selection:', s);
            
            xFocusScale.domain(s.map(xContextScale.invert, xContextScale));
            focus.select(".axis_x").call(xAxisFocus);
            svg.select(".zoom").call(zoom.transform, d3.zoomIdentity
                .scale(focusWidth / (s[1] - s[0]))
                .translate(-s[0], 0));
            
            self.startDate = xFocusScale.domain()[0];  // s[0]
            self.endDate = xFocusScale.domain()[1];  // s[1]
            self.loadSongsData(500);
        }
        
        function zoomedCallback() {
            const event = d3.event;
            if (!event.sourceEvent || !event.transform) return;
            //console.log('zoomed event:', event);
            if (event.sourceEvent && event.sourceEvent.type === "brush") return;
            let t = event.transform;
            //console.log('zoomed transform:', t);
            
            xFocusScale.domain(t.rescaleX(xContextScale).domain());
            focus.select(".axis_x").call(xAxisFocus);
            context.select(".brush").call(brush.move, xFocusScale.range().map(t.invertX, t));
            
            self.startDate = xFocusScale.domain()[0];  // s[0]
            self.endDate = xFocusScale.domain()[1];  // s[1]
            self.loadSongsData(500);
        }
    }, 
    
    plotSongs: function () {
        if (songDots) {
            songDots.remove();
            songDots = null;
        }
        
        let self = this;
        songDots = d3.select(".focus")
            .append("g")
            .selectAll("dot")
            .data(this.songsData)
            .enter()
            .append("circle")
            .attr("id", d => "song_" + d._id)
            .attr("cx", d => xFocusScale(d.release_date))
            .attr("cy", d => yFocusScale(d[this.currentAttr]))
            .attr("r", 7)
            .style("fill", d => colorScale(d.genre))
            .style("stroke", "white")
            .style("opacity", '0.7')
            .on("mouseover", function(d) {
                d3.select(this)
                    .style("stroke", "black");
                    
                const artistStr = d.artists.slice(0,1).map(a => a.name).join(', ') + (d.artists.length > 1 ? ' et al.' : '');
                //const dateStr = d.release_date.toISOString().substring(0,4);
                d3.select("#tooltip")
                    .style("visibility", "visible")
                    .html(d.name + "<br>By: " + artistStr)
                    .style("left", (d3.event.pageX - 5) + "px")
                    .style("top", (d3.event.pageY - 60) + "px");
            })
            .on("mouseleave", function() {
                d3.select(this)
                    .style("stroke", "white");
                    
                d3.select("#tooltip")
                    .style("visibility", "hidden")
                    .html("");
            })
            .on("click", async function(d) {
                const prevId = (self.selectedSong || {})._id; 
                if (prevId) {
                    if (d._id == prevId) {
                        return;
                    }
                    else {
                        d3.select("#song_" + prevId)
                            .style("fill", colorScale(d.genre));
                        self.selectedSong = {};
                    }
                }
                
                d3.select(this)
                    .style("fill", "black");
                    
                self.selectedSong = Object.assign({}, d);
                self.selectedSong.artistStr = d.artists.map(a => a.name).join(', ');
                
                const result = await self.getSongYoutubeUrl(d._id);
                self.selectedSong.url = (result || {}).url;
                self.$forceUpdate();
            });
    }
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">

#left_bar {
    position: absolute; // fixed;
    top: 15px;
    left: 15px;
    bottom: 15px;
    width: 23%;  // 350px;
    //height: 100%;
    background-color: #f8f8f8;
    border: 1px solid #aaa;
}

#timeline_container {
    width: 76%;
    height: 98%;
    overflow: auto;
    margin-left: 23%;  // 390px;
    margin-top: 20px;
}

rect.overlay {
    stroke: #999;
}

rect.selection {
    stroke: #666;
}

.tick line {
    stroke: #999;
    stroke-dasharray: 10;
}

</style>
